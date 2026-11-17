import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, SessionLocal
from app.routes import router, seed_default_endpoints_if_empty
from app.monitor import start_scheduler, stop_scheduler, run_monitoring_cycle

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("health_monitor.main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application Lifespan:
    1. Initializes database tables if missing.
    2. Seeds default endpoints if the table is empty.
    3. Starts the APScheduler background monitoring worker.
    4. Triggers an initial monitoring cycle.
    """
    logger.info("Initializing database schemas...")
    init_db()

    # Seed default endpoints
    db = SessionLocal()
    try:
        seed_default_endpoints_if_empty(db)
        logger.info("Default endpoints verified/seeded.")
    except Exception as e:
        logger.error("Failed to seed default endpoints: %s", e)
    finally:
        db.close()

    # Start background scheduler
    logger.info("Starting background scheduler...")
    start_scheduler()

    # Trigger one immediate background cycle
    asyncio.create_task(run_monitoring_cycle())

    yield

    # Clean shutdown
    logger.info("Shutting down background scheduler...")
    stop_scheduler()


app = FastAPI(
    title="Automated Linux Server & API Health Monitoring System",
    description="Production-grade monitoring system for Linux host telemetry and HTTP API endpoints.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(router)


@app.get("/", tags=["Root"])
def root_status():
    return {
        "service": "Automated Linux Server & API Health Monitoring System",
        "status": "online",
        "docs_url": "/docs",
        "health_check": "/api/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
