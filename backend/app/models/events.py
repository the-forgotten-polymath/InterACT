from enum import Enum
from typing import Optional, Dict, Any, Generic, TypeVar, List
from pydantic import BaseModel, Field
import time
import uuid
from .session import ParticipantRole

class EventType(str, Enum):
    # Session lifecycle
    SESSION_CREATED = "session.created"
    SESSION_JOINED = "session.joined"
    SESSION_ENDED = "session.ended"
    
    # Participants
    PARTICIPANT_JOINED = "participant.joined"
    PARTICIPANT_LEFT = "participant.left"
    PARTICIPANT_ACTIVITY = "participant.activity"
    
    # Messages
    MESSAGE_CREATED = "message.created"
    MESSAGE_DELIVERED = "message.delivered"
    
    # Fluency Shield / Speech Assistance
    SPEECH_TRANSCRIBED = "speech.transcribed"
    SPEECH_RECONSTRUCTED = "speech.reconstructed"
    SPEECH_APPROVED = "speech.approved"
    
    # Gesture Macros
    GESTURE_DETECTED = "gesture.detected"
    GESTURE_CONFIRMED = "gesture.confirmed"
    
    # Smart Voice Chips
    CHIPS_SUGGESTED = "chips.suggested"
    CHIP_SELECTED = "chip.selected"
    
    # Visual Communication
    CARD_SENT = "card.sent"
    CARD_ACTION = "card.action"
    
    # Real-Time WebRTC Calling
    RTC_SIGNAL = "rtc.signal"
    
    # Connectivity
    PING = "ping"
    PONG = "pong"
    ERROR = "error"

class ActivityType(str, Enum):
    TYPING = "typing"
    RECORDING = "recording"
    TRANSCRIBING = "transcribing"
    REVIEWING = "reviewing"
    PROCESSING_GESTURE = "processing_gesture"
    IDLE = "idle"

class MessageSource(str, Enum):
    TEXT = "text"
    SPEECH = "speech"
    GESTURE = "gesture"
    SMART_CHIP = "smart_chip"

def generate_event_id() -> str:
    return f"evt_{uuid.uuid4().hex[:12]}"

class Event(BaseModel):
    event_id: str = Field(default_factory=generate_event_id)
    event_type: EventType
    session_id: str
    timestamp: float = Field(default_factory=lambda: round(time.time() * 1000))
    sender_id: Optional[str] = None
    sender_role: Optional[ParticipantRole] = None
    payload: Dict[str, Any] = Field(default_factory=dict)

# Specific payload schemas for typed validation
class MessagePayload(BaseModel):
    message_id: str = Field(default_factory=lambda: f"msg_{uuid.uuid4().hex[:12]}")
    source: MessageSource = MessageSource.TEXT
    text: str
    language: str = "en"
    audio_url: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)

class ActivityPayload(BaseModel):
    activity: ActivityType
    details: Optional[str] = None

class SpeechReconstructedPayload(BaseModel):
    raw_transcript: str
    reconstructed_text: str
    disfluencies: List[str] = Field(default_factory=list)
    confidence: float = 1.0

class SpeechApprovedPayload(BaseModel):
    approved_text: str
    was_edited: bool = False
    generate_tts: bool = True

class GesturePayload(BaseModel):
    gesture_name: str
    phrase: str
    confidence: float

class VoiceChipsPayload(BaseModel):
    chips: List[str]
    context_summary: Optional[str] = None

class VisualCardPayload(BaseModel):
    card_id: str = Field(default_factory=lambda: f"card_{uuid.uuid4().hex[:8]}")
    card_type: str  # "refund", "appointment", "instructions", "confirmation"
    title: str
    data: Dict[str, Any] = Field(default_factory=dict)
