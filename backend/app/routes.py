from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import MonitoredEndpoint, SystemMetric, ApiCheckLog, IncidentLog
from app.schemas import (
    EndpointCreate,
    EndpointResponse,
    EndpointWithStatusResponse,
    LatestMetricsResponse,
    SystemMetricResponse,
    IncidentResponse,
    HealthResponse,
)
from app.monitor import run_monitoring_cycle, scheduler, get_system_snapshot

router = APIRouter(prefix="/api", tags=["Monitoring"])


def seed_default_endpoints_if_empty(db: Session):
    """Populates initial default endpoints if table is currently empty."""
    existing_count = db.query(MonitoredEndpoint).count()
    if existing_count == 0:
        default_endpoints = [
            MonitoredEndpoint(name="GitHub API", url="https://api.github.com"),
            MonitoredEndpoint(name="Google Search", url="https://www.google.com"),
            MonitoredEndpoint(name="HTTPBin Health", url="https://httpbin.org/status/200"),
        ]
        db.add_all(default_endpoints)
        db.commit()


@router.get("/health", response_model=HealthResponse)
def health_check(db: Session = Depends(get_db)):
    """Health check endpoint returning system status and DB connectivity."""
    db_connected = True
    active_count = 0
    try:
        active_count = db.query(MonitoredEndpoint).filter(MonitoredEndpoint.is_active == True).count()
    except Exception:
        db_connected = False

    return HealthResponse(
        status="healthy" if db_connected else "degraded",
        scheduler_running=bool(scheduler.running),
        timestamp=datetime.now(timezone.utc),
        active_endpoints_count=active_count,
        database_connected=db_connected,
    )


@router.get("/metrics/latest", response_model=LatestMetricsResponse)
def get_latest_metrics(db: Session = Depends(get_db)):
    """
    Returns the latest recorded system metric (or instant psutil snapshot)
    and the last 25 system metric records in chronological order for time-series charts.
    """
    # Fetch last 25 records ordered newest first, then reverse for chronological order
    recent_records = (
        db.query(SystemMetric)
        .order_by(SystemMetric.timestamp.desc())
        .limit(25)
        .all()
    )
    chronological_history = list(reversed(recent_records))

    latest_record = recent_records[0] if recent_records else None

    # Fallback to instant live snapshot if no records exist in DB yet
    if not latest_record:
        snapshot = get_system_snapshot()
        fallback_metric = SystemMetric(
            id=0,
            cpu_percent=snapshot["cpu_percent"],
            memory_percent=snapshot["memory_percent"],
            disk_percent=snapshot["disk_percent"],
            timestamp=datetime.now(timezone.utc),
        )
        return LatestMetricsResponse(
            latest=SystemMetricResponse.model_validate(fallback_metric),
            history=[],
        )

    return LatestMetricsResponse(
        latest=SystemMetricResponse.model_validate(latest_record),
        history=[SystemMetricResponse.model_validate(m) for m in chronological_history],
    )


@router.get("/endpoints", response_model=List[EndpointWithStatusResponse])
def list_endpoints(db: Session = Depends(get_db)):
    """
    Returns all monitored endpoints with their latest check result,
    response latency (ms), and calculated uptime percentage.
    """
    endpoints = db.query(MonitoredEndpoint).order_by(MonitoredEndpoint.created_at.asc()).all()
    response_list: List[EndpointWithStatusResponse] = []

    for ep in endpoints:
        # Latest check log
        latest_log = (
            db.query(ApiCheckLog)
            .filter(ApiCheckLog.endpoint_id == ep.id)
            .order_by(ApiCheckLog.checked_at.desc())
            .first()
        )

        # Calculate uptime %
        total_checks = (
            db.query(func.count(ApiCheckLog.id))
            .filter(ApiCheckLog.endpoint_id == ep.id)
            .scalar()
            or 0
        )
        up_checks = (
            db.query(func.count(ApiCheckLog.id))
            .filter(ApiCheckLog.endpoint_id == ep.id, ApiCheckLog.is_up == True)
            .scalar()
            or 0
        )

        if total_checks > 0:
            uptime_pct = round((up_checks / total_checks) * 100.0, 1)
        else:
            uptime_pct = 100.0

        item = EndpointWithStatusResponse(
            id=ep.id,
            name=ep.name,
            url=ep.url,
            is_active=ep.is_active,
            created_at=ep.created_at,
            latest_status=latest_log.is_up if latest_log else None,
            latest_status_code=latest_log.status_code if latest_log else None,
            latest_response_time_ms=latest_log.response_time_ms if latest_log else None,
            last_checked_at=latest_log.checked_at if latest_log else None,
            uptime_percentage=uptime_pct,
        )
        response_list.append(item)

    return response_list


@router.post("/endpoints", response_model=EndpointResponse, status_code=status.HTTP_201_CREATED)
def create_endpoint(payload: EndpointCreate, db: Session = Depends(get_db)):
    """Registers a new HTTP/HTTPS endpoint for automated health monitoring."""
    new_endpoint = MonitoredEndpoint(
        name=payload.name.strip(),
        url=payload.url.strip(),
        is_active=True,
    )
    db.add(new_endpoint)
    db.commit()
    db.refresh(new_endpoint)
    return new_endpoint


@router.delete("/endpoints/{endpoint_id}", status_code=status.HTTP_200_OK)
def delete_endpoint(endpoint_id: int, db: Session = Depends(get_db)):
    """Deletes an endpoint and cascades deletion to all associated check logs."""
    endpoint = db.query(MonitoredEndpoint).filter(MonitoredEndpoint.id == endpoint_id).first()
    if not endpoint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Endpoint with ID {endpoint_id} not found.",
        )

    db.delete(endpoint)
    db.commit()
    return {"message": f"Endpoint '{endpoint.name}' (ID: {endpoint_id}) successfully removed"}


@router.get("/incidents", response_model=List[IncidentResponse])
def list_incidents(db: Session = Depends(get_db)):
    """Returns the latest 30 incident and alert events, ordered newest first."""
    incidents = (
        db.query(IncidentLog)
        .order_by(IncidentLog.created_at.desc())
        .limit(30)
        .all()
    )
    return [IncidentResponse.model_validate(inc) for inc in incidents]


@router.post("/monitor/trigger")
async def trigger_monitoring_cycle():
    """Manually triggers an immediate monitoring cycle for instant evaluation."""
    results = await run_monitoring_cycle()
    return {
        "status": "success",
        "message": "Immediate monitoring cycle executed successfully",
        "summary": results,
    }
