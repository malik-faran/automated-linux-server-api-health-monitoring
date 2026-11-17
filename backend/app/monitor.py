import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Dict, Any, List
import httpx
import psutil
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import MonitoredEndpoint, SystemMetric, ApiCheckLog, IncidentLog
from app.alerts import send_webhook_alert, alert_tracker

logger = logging.getLogger("health_monitor.worker")

# Shared AsyncIOScheduler instance
scheduler = AsyncIOScheduler()


def get_system_snapshot() -> Dict[str, float]:
    """Captures instant CPU, Memory, and Disk usage via psutil."""
    cpu = psutil.cpu_percent(interval=0.1)
    mem = psutil.virtual_memory().percent
    try:
        disk = psutil.disk_usage("/").percent
    except Exception:
        disk = 0.0
    return {
        "cpu_percent": float(cpu),
        "memory_percent": float(mem),
        "disk_percent": float(disk),
    }


async def record_system_metrics(db: Session) -> SystemMetric:
    """Collects host metrics, commits to DB, and checks thresholds."""
    snapshot = get_system_snapshot()
    metric = SystemMetric(
        cpu_percent=snapshot["cpu_percent"],
        memory_percent=snapshot["memory_percent"],
        disk_percent=snapshot["disk_percent"],
    )
    db.add(metric)
    db.commit()
    db.refresh(metric)

    # Check CPU threshold (> 85%)
    cpu_high = snapshot["cpu_percent"] > 85.0
    cpu_sev = "CRITICAL" if snapshot["cpu_percent"] > 95.0 else "WARNING"
    cpu_transition = alert_tracker.check_state("System CPU", is_degraded=cpu_high, severity=cpu_sev)

    if cpu_transition:
        is_resolved = (cpu_transition == "RESOLVED")
        msg = (
            f"Host CPU normalized to {snapshot['cpu_percent']}%"
            if is_resolved
            else f"Host CPU elevated: {snapshot['cpu_percent']}% (threshold: 85%)"
        )
        incident = IncidentLog(
            source="System CPU",
            severity=cpu_transition,
            message=msg,
            resolved=is_resolved,
        )
        db.add(incident)
        db.commit()
        await send_webhook_alert(
            title=f"Host CPU {cpu_transition.title()}",
            message=msg,
            severity=cpu_transition,
        )

    # Check Memory threshold (> 85%)
    mem_high = snapshot["memory_percent"] > 85.0
    mem_sev = "CRITICAL" if snapshot["memory_percent"] > 95.0 else "WARNING"
    mem_transition = alert_tracker.check_state("System Memory", is_degraded=mem_high, severity=mem_sev)

    if mem_transition:
        is_resolved = (mem_transition == "RESOLVED")
        msg = (
            f"Host Memory normalized to {snapshot['memory_percent']}%"
            if is_resolved
            else f"Host Memory elevated: {snapshot['memory_percent']}% (threshold: 85%)"
        )
        incident = IncidentLog(
            source="System Memory",
            severity=mem_transition,
            message=msg,
            resolved=is_resolved,
        )
        db.add(incident)
        db.commit()
        await send_webhook_alert(
            title=f"Host Memory {mem_transition.title()}",
            message=msg,
            severity=mem_transition,
        )

    return metric


async def probe_endpoint(client: httpx.AsyncClient, endpoint: MonitoredEndpoint, db: Session) -> Dict[str, Any]:
    """Pings a single endpoint with a 5s timeout and records check log & incident if applicable."""
    start_time = time.perf_counter()
    status_code = None
    is_up = False
    err_str = None

    try:
        response = await client.get(endpoint.url, follow_redirects=True)
        response_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        status_code = response.status_code
        is_up = (response.status_code < 400)
    except httpx.TimeoutException:
        response_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        err_str = "Request Timed Out (5.0s threshold exceeded)"
    except httpx.RequestError as exc:
        response_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        err_str = f"Connection Failed: {type(exc).__name__}"
    except Exception as exc:
        response_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        err_str = f"Unexpected Error: {str(exc)}"

    # Record check log in DB
    log_entry = ApiCheckLog(
        endpoint_id=endpoint.id,
        status_code=status_code,
        response_time_ms=response_time_ms,
        is_up=is_up,
    )
    db.add(log_entry)
    db.commit()

    # Incident state tracking
    source_name = f"Endpoint: {endpoint.name}"
    is_degraded = not is_up
    transition = alert_tracker.check_state(source_name, is_degraded=is_degraded, severity="CRITICAL")

    if transition:
        is_resolved = (transition == "RESOLVED")
        if is_resolved:
            msg = f"{endpoint.name} ({endpoint.url}) has RECOVERED. Status: {status_code}, Latency: {response_time_ms}ms."
        else:
            reason = f"HTTP {status_code}" if status_code else err_str
            msg = f"{endpoint.name} ({endpoint.url}) is DOWN. Reason: {reason}."

        incident = IncidentLog(
            source=source_name,
            severity=transition,
            message=msg,
            resolved=is_resolved,
        )
        db.add(incident)
        db.commit()
        await send_webhook_alert(
            title=f"API Status: {endpoint.name}",
            message=msg,
            severity=transition,
        )

    return {
        "endpoint_id": endpoint.id,
        "name": endpoint.name,
        "url": endpoint.url,
        "is_up": is_up,
        "status_code": status_code,
        "response_time_ms": response_time_ms,
        "error": err_str,
    }


async def run_monitoring_cycle() -> Dict[str, Any]:
    """
    Executes a complete monitoring sweep:
    1. Collects system CPU, RAM, Disk.
    2. Concurrently probes all active endpoints with 5s timeout.
    3. Handles incidents and alerting.
    """
    logger.info("Executing monitoring cycle...")
    db: Session = SessionLocal()
    results: List[Dict[str, Any]] = []
    metric_data: Dict[str, Any] = {}

    try:
        # 1. System Metrics
        metric = await record_system_metrics(db)
        metric_data = {
            "cpu_percent": metric.cpu_percent,
            "memory_percent": metric.memory_percent,
            "disk_percent": metric.disk_percent,
            "timestamp": metric.timestamp.isoformat(),
        }

        # 2. Concurrently ping active endpoints
        endpoints = db.query(MonitoredEndpoint).filter(MonitoredEndpoint.is_active == True).all()

        if endpoints:
            limits = httpx.Limits(max_keepalive_connections=10, max_connections=20)
            async with httpx.AsyncClient(timeout=5.0, limits=limits) as client:
                tasks = [probe_endpoint(client, ep, db) for ep in endpoints]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                # Normalize any exceptions caught during gather
                clean_results = []
                for res in results:
                    if isinstance(res, Exception):
                        clean_results.append({"error": str(res), "is_up": False})
                    else:
                        clean_results.append(res)
                results = clean_results

        logger.info(
            "Cycle completed: Host (CPU: %.1f%%, RAM: %.1f%%), %d endpoints verified",
            metric_data["cpu_percent"],
            metric_data["memory_percent"],
            len(endpoints),
        )

    except Exception as e:
        logger.error("Error during monitoring cycle: %s", e, exc_info=True)
    finally:
        db.close()

    return {
        "system_metrics": metric_data,
        "endpoints_checked": len(results),
        "results": results,
    }


def start_scheduler():
    """Initializes and starts APScheduler if not already active."""
    if not scheduler.running:
        scheduler.add_job(
            run_monitoring_cycle,
            trigger="interval",
            seconds=30,
            id="periodic_monitor",
            replace_existing=True,
            coalesce=True,
            max_instances=1,
        )
        scheduler.start()
        logger.info("APScheduler background monitoring service started (30s interval)")


def stop_scheduler():
    """Stops the scheduler on application shutdown."""
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("APScheduler background monitoring service stopped")
