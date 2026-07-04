from fastapi import FastAPI
from sqlalchemy import text

from app.api.routes.jobs import router as jobs_router
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.redis import get_redis_client

app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
)

app.include_router(jobs_router, prefix="/api/v1/jobs", tags=["Jobs"])


@app.get("/")
def root():
    return {
        "message": "TaskForge API is running",
        "environment": settings.APP_ENV,
    }


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/health/deps")
def health_deps():
    db_ok = False
    redis_ok = False

    # Check PostgreSQL
    try:
        with SessionLocal() as db:
            db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:
        db_ok = False

    # Check Redis
    try:
        redis_client = get_redis_client()
        redis_client.ping()
        redis_ok = True
    except Exception:
        redis_ok = False

    overall = "ok" if db_ok and redis_ok else "degraded"

    return {
        "status": overall,
        "database": "ok" if db_ok else "down",
        "redis": "ok" if redis_ok else "down",
    }