from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator


class EndpointCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255, description="Readable endpoint name")
    url: str = Field(..., min_length=4, max_length=1024, description="Full HTTP/HTTPS URL")

    @field_validator("url")
    @classmethod
    def validate_url(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL must start with http:// or https://")
        return v


class EndpointResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    url: str
    is_active: bool
    created_at: datetime


class EndpointWithStatusResponse(EndpointResponse):
    latest_status: Optional[bool] = None
    latest_status_code: Optional[int] = None
    latest_response_time_ms: Optional[float] = None
    last_checked_at: Optional[datetime] = None
    uptime_percentage: float = 100.0


class SystemMetricResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cpu_percent: float
    memory_percent: float
    disk_percent: float
    timestamp: datetime


class LatestMetricsResponse(BaseModel):
    latest: Optional[SystemMetricResponse] = None
    history: List[SystemMetricResponse] = []


class IncidentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source: str
    severity: str
    message: str
    resolved: bool
    created_at: datetime


class HealthResponse(BaseModel):
    status: str
    scheduler_running: bool
    timestamp: datetime
    active_endpoints_count: int
    database_connected: bool
