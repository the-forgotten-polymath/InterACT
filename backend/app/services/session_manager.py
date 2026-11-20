import random
import string
import time
from typing import Optional, Dict, List
from fastapi import HTTPException
from ..core.config import settings
from ..models.session import (
    Session,
    Participant,
    SessionStatus,
    ParticipantRole,
    ConnectionStatus,
    BusinessContext
)

def generate_session_code(length: int = 6) -> str:
    # Avoid ambiguous characters (0, O, 1, I)
    alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    return "".join(random.choice(alphabet) for _ in range(length))

class SessionManager:
    def __init__(self):
        # In-memory store for instant zero-dependency execution
        self._sessions: Dict[str, Session] = {}

    def create_session(
        self,
        business_context: Optional[BusinessContext] = None,
        config: Optional[Dict] = None,
        organization_id: str = "org_default"
    ) -> Session:
        # Generate unique code
        for _ in range(10):
            code = generate_session_code(settings.SESSION_CODE_LENGTH)
            if code not in self._sessions:
                break
        else:
            code = f"SESS_{int(time.time())}"

        now = time.time()
        expires_at = now + (settings.SESSION_EXPIRY_HOURS * 3600)

        session = Session(
            session_id=code,
            organization_id=organization_id,
            status=SessionStatus.ACTIVE,
            business_context=business_context or BusinessContext(),
            config=config or {},
            created_at=now,
            expires_at=expires_at,
            participants={}
        )
        self._sessions[code] = session
        return session

    def get_session(self, session_id: str) -> Optional[Session]:
        clean_id = session_id.strip().upper()
        session = self._sessions.get(clean_id)
        if not session:
            return None

        # Check expiration
        if session.status == SessionStatus.ACTIVE and time.time() > session.expires_at:
            session.status = SessionStatus.EXPIRED
        return session

    def join_session(
        self,
        session_id: str,
        role: ParticipantRole,
        participant_id: Optional[str] = None,
        preferences: Optional[Dict] = None
    ) -> Participant:
        clean_id = session_id.strip().upper()
        session = self.get_session(clean_id)

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if session.status != SessionStatus.ACTIVE:
            raise HTTPException(
                status_code=400,
                detail=f"Session is {session.status.value} and cannot be joined"
            )

        # Generate participant_id if not provided
        pid = participant_id or f"{role.value}_{random.randint(1000, 9999)}"

        # Enforce 1 customer + 1 agent for standard support sessions
        for existing_pid, p in session.participants.items():
            if p.role == role and existing_pid != pid and p.connection_status == ConnectionStatus.CONNECTED:
                raise HTTPException(
                    status_code=409,
                    detail=f"A {role.value} is already connected to this session"
                )

        participant = Participant(
            participant_id=pid,
            role=role,
            joined_at=time.time(),
            preferences=preferences or {},
            connection_status=ConnectionStatus.CONNECTED
        )
        session.participants[pid] = participant
        return participant

    def end_session(
        self,
        session_id: str,
        ended_by: Optional[str] = None,
        reason: Optional[str] = "resolved"
    ) -> Session:
        clean_id = session_id.strip().upper()
        session = self.get_session(clean_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        session.status = SessionStatus.ENDED
        session.ended_at = time.time()
        session.ended_by = ended_by
        session.end_reason = reason
        return session

    def list_sessions(self) -> List[Session]:
        return list(self._sessions.values())

    def cleanup_expired(self) -> int:
        now = time.time()
        expired_count = 0
        for s in self._sessions.values():
            if s.status == SessionStatus.ACTIVE and now > s.expires_at:
                s.status = SessionStatus.EXPIRED
                expired_count += 1
        return expired_count

session_manager = SessionManager()
