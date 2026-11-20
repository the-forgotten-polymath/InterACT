from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
import time

class SessionStatus(str, Enum):
    ACTIVE = "active"
    ENDED = "ended"
    EXPIRED = "expired"

class ParticipantRole(str, Enum):
    CUSTOMER = "customer"
    AGENT = "agent"
    KIOSK = "kiosk"

class ConnectionStatus(str, Enum):
    CONNECTED = "connected"
    DISCONNECTED = "disconnected"
    RECONNECTING = "reconnecting"

class BusinessContext(BaseModel):
    type: str = "order"  # "order", "banking", "hospital", "general"
    id: Optional[str] = None
    data: Dict[str, Any] = Field(default_factory=dict)

class Participant(BaseModel):
    participant_id: str
    role: ParticipantRole
    joined_at: float = Field(default_factory=time.time)
    preferences: Dict[str, Any] = Field(default_factory=dict)
    connection_status: ConnectionStatus = ConnectionStatus.CONNECTED

class Session(BaseModel):
    session_id: str
    organization_id: str = "org_default"
    status: SessionStatus = SessionStatus.ACTIVE
    business_context: BusinessContext = Field(default_factory=BusinessContext)
    config: Dict[str, Any] = Field(default_factory=dict)
    created_at: float = Field(default_factory=time.time)
    expires_at: float
    participants: Dict[str, Participant] = Field(default_factory=dict)
    ended_at: Optional[float] = None
    ended_by: Optional[str] = None
    end_reason: Optional[str] = None

# API Request & Response Models
class CreateSessionRequest(BaseModel):
    organization_id: Optional[str] = "org_default"
    business_context: Optional[BusinessContext] = None
    config: Optional[Dict[str, Any]] = None

class CreateSessionResponse(BaseModel):
    session_id: str
    status: SessionStatus
    created_at: float
    expires_at: float
    websocket_url: str

class JoinSessionRequest(BaseModel):
    participant_id: Optional[str] = None
    role: ParticipantRole
    preferences: Optional[Dict[str, Any]] = None

class JoinSessionResponse(BaseModel):
    session_id: str
    participant_id: str
    role: ParticipantRole
    status: SessionStatus
    websocket_url: str

class EndSessionRequest(BaseModel):
    ended_by: Optional[str] = None
    reason: Optional[str] = "resolved"

class EndSessionResponse(BaseModel):
    session_id: str
    status: SessionStatus
    ended_at: float
    duration_seconds: float
