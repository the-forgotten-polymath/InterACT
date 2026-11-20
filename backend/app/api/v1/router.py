from fastapi import APIRouter
from .endpoints import health, sessions, ws, speech, fluency

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(sessions.router, prefix="/sessions", tags=["Sessions"])
api_router.include_router(ws.router, prefix="/ws", tags=["WebSocket"])
api_router.include_router(speech.router, prefix="/speech", tags=["Speech"])
api_router.include_router(fluency.router, prefix="/fluency", tags=["Fluency Shield"])
