import os
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import MonitoredEndpoint, IncidentLog, SystemMetric

# In-memory SQLite database isolated for testing
SQLALCHEMY_TEST_DATABASE_URL = "sqlite:///:memory:"

test_engine = create_engine(
    SQLALCHEMY_TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    Base.metadata.drop_all(bind=test_engine)
    app.dependency_overrides.clear()


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_1_health_check(client):
    """Test 1: Health check endpoint returns valid operational status."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] in ("healthy", "degraded")
    assert "database_connected" in data
    assert data["database_connected"] is True
    assert "timestamp" in data


def test_2_create_endpoint(client):
    """Test 2: Registering a new monitored endpoint."""
    payload = {
        "name": "Cloudflare DNS",
        "url": "https://1.1.1.1",
    }
    response = client.post("/api/endpoints", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Cloudflare DNS"
    assert data["url"] == "https://1.1.1.1"
    assert data["is_active"] is True
    assert "id" in data


def test_3_list_endpoints(client):
    """Test 3: Listing monitored endpoints includes status and uptime calculations."""
    response = client.get("/api/endpoints")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1

    # Verify endpoint properties
    cf_endpoint = next((ep for ep in data if ep["name"] == "Cloudflare DNS"), None)
    assert cf_endpoint is not None
    assert "uptime_percentage" in cf_endpoint
    assert cf_endpoint["uptime_percentage"] == 100.0


def test_4_get_latest_metrics(client):
    """Test 4: System telemetry metrics retrieval returns CPU, RAM, Disk, and history."""
    # Seed a metric in the test DB
    db = TestingSessionLocal()
    sample_metric = SystemMetric(cpu_percent=42.5, memory_percent=60.0, disk_percent=55.2)
    db.add(sample_metric)
    db.commit()
    db.close()

    response = client.get("/api/metrics/latest")
    assert response.status_code == 200
    data = response.json()
    assert "latest" in data
    assert data["latest"] is not None
    assert "cpu_percent" in data["latest"]
    assert "memory_percent" in data["latest"]
    assert "disk_percent" in data["latest"]
    assert isinstance(data["history"], list)
    assert len(data["history"]) >= 1


def test_5_incident_logging_and_endpoint_deletion(client):
    """Test 5: Incident log creation, retrieval, and cascading endpoint deletion."""
    db = TestingSessionLocal()
    # Add a mock incident
    incident = IncidentLog(
        source="System CPU",
        severity="WARNING",
        message="CPU threshold exceeded (88.5%)",
        resolved=False,
    )
    db.add(incident)
    db.commit()
    db.close()

    # Verify incident appears in /api/incidents
    inc_response = client.get("/api/incidents")
    assert inc_response.status_code == 200
    inc_data = inc_response.json()
    assert isinstance(inc_data, list)
    assert len(inc_data) >= 1
    found = any(i["source"] == "System CPU" and i["severity"] == "WARNING" for i in inc_data)
    assert found is True

    # Get endpoints list and pick one to delete
    list_response = client.get("/api/endpoints")
    endpoints = list_response.json()
    ep_to_delete = next((ep for ep in endpoints if ep["name"] == "Cloudflare DNS"), None)
    assert ep_to_delete is not None
    target_id = ep_to_delete["id"]

    # Delete endpoint
    del_response = client.delete(f"/api/endpoints/{target_id}")
    assert del_response.status_code == 200

    # Ensure 404 when trying to delete again
    del_again_response = client.delete(f"/api/endpoints/{target_id}")
    assert del_again_response.status_code == 404
