import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes.jobs import router as jobs_router
from app.api.routes.queues import router as queues_router
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.redis import get_redis_client
from app.core.event_listener import redis_event_listener


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start Redis Pub/Sub event listener background task
    listener_task = asyncio.create_task(redis_event_listener())
    yield
    # Cleanup task on shutdown
    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jobs_router, prefix="/api/v1/jobs", tags=["Jobs"])
app.include_router(queues_router, prefix="/api/v1/queues", tags=["Queues"])


@app.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    from app.core.websocket_manager import manager
    
    await manager.connect(websocket)
    try:
        # Keepalive read loop
        while True:
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        import logging
        logger = logging.getLogger("app.main")
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


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