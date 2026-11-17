from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


def utc_now():
    """Returns current UTC datetime without tzinfo for DB consistency."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class MonitoredEndpoint(Base):
    """Monitored API / HTTP Endpoint."""
    __tablename__ = "monitored_endpoints"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    url = Column(String(1024), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    # Cascade delete logs when endpoint is removed
    check_logs = relationship(
        "ApiCheckLog",
        back_populates="endpoint",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class SystemMetric(Base):
    """Recorded Host CPU, Memory, and Disk usage snapshot."""
    __tablename__ = "system_metrics"

    id = Column(Integer, primary_key=True, index=True)
    cpu_percent = Column(Float, nullable=False)
    memory_percent = Column(Float, nullable=False)
    disk_percent = Column(Float, nullable=False)
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)


class ApiCheckLog(Base):
    """Result of an HTTP probe on a monitored endpoint."""
    __tablename__ = "api_check_logs"

    id = Column(Integer, primary_key=True, index=True)
    endpoint_id = Column(
        Integer,
        ForeignKey("monitored_endpoints.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    status_code = Column(Integer, nullable=True)
    response_time_ms = Column(Float, nullable=False)
    is_up = Column(Boolean, nullable=False, default=True)
    checked_at = Column(DateTime, default=utc_now, nullable=False, index=True)

    endpoint = relationship("MonitoredEndpoint", back_populates="check_logs")


class IncidentLog(Base):
    """System and Endpoint Incident / Alert event history."""
    __tablename__ = "incident_logs"

    id = Column(Integer, primary_key=True, index=True)
    source = Column(String(255), nullable=False, index=True)
    severity = Column(String(50), nullable=False)  # "WARNING", "CRITICAL", "RESOLVED"
    message = Column(Text, nullable=False)
    resolved = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=utc_now, nullable=False, index=True)
