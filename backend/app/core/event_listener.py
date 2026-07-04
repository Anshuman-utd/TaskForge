import asyncio
import logging
import redis.asyncio as aioredis
from app.core.config import settings
from app.core.websocket_manager import manager
from app.core.events import REDIS_EVENTS_CHANNEL

logger = logging.getLogger("app.event_listener")


async def redis_event_listener():
    """
    Subscribes to Redis job events channel and broadcasts them to active WebSocket clients.
    Includes reconnection logic in case Redis connection is lost.
    """
    logger.info("Starting Redis event listener background task...")
    while True:
        try:
            redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
            pubsub = redis_client.pubsub()
            await pubsub.subscribe(REDIS_EVENTS_CHANNEL)
            logger.info(f"Subscribed to Redis channel: {REDIS_EVENTS_CHANNEL}")
            
            async for message in pubsub.listen():
                if message["type"] == "message":
                    payload = message["data"]
                    await manager.broadcast(payload)
        except asyncio.CancelledError:
            logger.info("Redis event listener task cancelled.")
            break
        except Exception as e:
            logger.error(f"Error in Redis event listener: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)
