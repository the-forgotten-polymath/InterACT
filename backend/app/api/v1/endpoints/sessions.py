from fastapi import APIRouter, HTTPException, Request
from typing import List
from ....models.session import (
    Session,
    CreateSessionRequest,
    CreateSessionResponse,
    JoinSessionRequest,
    JoinSessionResponse,
    EndSessionRequest,
    EndSessionResponse
)
from ....services.session_manager import session_manager
from ....core.config import settings

router = APIRouter()

@router.post("", response_model=CreateSessionResponse, status_code=201)
async def create_session(req: CreateSessionRequest, request: Request):
    session = session_manager.create_session(
        business_context=req.business_context,
        config=req.config,
        organization_id=req.organization_id or "org_default"
    )
    
    ws_base = str(request.base_url).replace("http://", "ws://").replace("https://", "wss://").rstrip("/")
    ws_url = f"{ws_base}{settings.API_V1_STR}/ws/sessions/{session.session_id}"

    return CreateSessionResponse(
        session_id=session.session_id,
        status=session.status,
        created_at=session.created_at,
        expires_at=session.expires_at,
        websocket_url=ws_url
    )

@router.get("/{session_id}", response_model=Session)
async def get_session(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session

@router.post("/{session_id}/join", response_model=JoinSessionResponse)
async def join_session(session_id: str, req: JoinSessionRequest, request: Request):
    participant = session_manager.join_session(
        session_id=session_id,
        role=req.role,
        participant_id=req.participant_id,
        preferences=req.preferences
    )
    
    session = session_manager.get_session(session_id)
    ws_base = str(request.base_url).replace("http://", "ws://").replace("https://", "wss://").rstrip("/")
    ws_url = f"{ws_base}{settings.API_V1_STR}/ws/sessions/{session.session_id}?participant_id={participant.participant_id}"

    return JoinSessionResponse(
        session_id=session.session_id,
        participant_id=participant.participant_id,
        role=participant.role,
        status=session.status,
        websocket_url=ws_url
    )

@router.post("/{session_id}/end", response_model=EndSessionResponse)
async def end_session(session_id: str, req: EndSessionRequest):
    session = session_manager.end_session(
        session_id=session_id,
        ended_by=req.ended_by,
        reason=req.reason
    )
    duration = session.ended_at - session.created_at
    return EndSessionResponse(
        session_id=session.session_id,
        status=session.status,
        ended_at=session.ended_at,
        duration_seconds=round(duration, 2)
    )

@router.get("", response_model=List[Session])
async def list_sessions():
    return session_manager.list_sessions()
