# InterACT — Implementation Guide

**Version:** 1.0  
**Purpose:** Step-by-step guide to implement InterACT from scratch  
**Estimated Timeline:** 32 weeks (see Phase document for breakdown)

---

## Table of Contents
1. [Quick Start](#quick-start)
2. [Phase-by-Phase Implementation](#phase-by-phase-implementation)
3. [Common Pitfalls](#common-pitfalls)
4. [Troubleshooting](#troubleshooting)
5. [Performance Optimization](#performance-optimization)
6. [Deployment Guide](#deployment-guide)

---

## 1. Quick Start

### 1.1 First Day Checklist

```bash
# Day 1: Get the foundation running

# 1. Clone and setup
git clone <repo-url>
cd interact

# 2. Start infrastructure
docker-compose up -d postgres redis

# 3. Setup backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# 4. Setup frontend (new terminal)
cd frontend
npm install
npm run dev

# 5. Verify
curl http://localhost:8000/health
curl http://localhost:3000

# You should see both services running!
```

### 1.2 First Week Goals

```markdown
Week 1 Objectives:
- [ ] Development environment fully functional
- [ ] Database schema created and understood
- [ ] Basic API endpoints working
- [ ] Frontend can call backend
- [ ] WebSocket connection established
- [ ] First test suite passing
- [ ] CI pipeline configured
```

---

## 2. Phase-by-Phase Implementation

## Phase 0: Foundation (Weeks 1-2)

### Week 1: Setup & Architecture

**Day 1-2: Repository Setup**
```bash
# Create project structure
mkdir -p interact/{backend,frontend,sdk,ios-kiosk,infrastructure,docs}

# Initialize backend
cd backend
mkdir -p app/{api,core,services,models,utils} tests
touch app/__init__.py app/main.py
```

**Day 3-4: Database Setup**
```bash
# Install PostgreSQL and Redis
docker-compose up -d

# Create database schema
cd backend
alembic init alembic
alembic revision --autogenerate -m "initial schema"
alembic upgrade head

# Verify
psql -U interact -d interact_dev -c "\dt"
```

**Day 5: CI/CD Pipeline**
```yaml
# Setup GitHub Actions
# Create .github/workflows/ci.yml
# Configure linting, testing, security scan
# Run first successful CI build
```

### Week 2: Core Infrastructure

**Core Services Implementation:**

```python
# backend/app/core/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    GEMINI_API_KEY: str
    SECRET_KEY: str
    ENVIRONMENT: str = "development"
    
    class Config:
        env_file = ".env"

settings = Settings()
```

```python
# backend/app/core/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

engine = create_async_engine(settings.DATABASE_URL)
AsyncSessionLocal = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
```

```python
# backend/app/core/redis_client.py
import aioredis
from typing import Optional

class RedisClient:
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
    
    async def connect(self):
        self._redis = await aioredis.from_url(settings.REDIS_URL)
    
    async def get(self, key: str) -> Optional[str]:
        return await self._redis.get(key)
    
    async def set(self, key: str, value: str, ex: int = None):
        await self._redis.set(key, value, ex=ex)

redis_client = RedisClient()
```

**Testing Infrastructure:**
```python
# tests/conftest.py
import pytest
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.core.config import settings

@pytest.fixture(scope="session")
async def test_db():
    """Create test database"""
    engine = create_async_engine(
        "postgresql+asyncpg://test:test@localhost/interact_test"
    )
    # Run migrations
    yield engine
    await engine.dispose()

@pytest.fixture
async def db_session(test_db):
    """Get database session for test"""
    async with AsyncSession(test_db) as session:
        yield session
        await session.rollback()
```

---

## Phase 1: Core Communication (Weeks 3-5)

### Week 3: Session Management

**Implementation Steps:**

1. **Create Session Models** (Day 1)
```python
# backend/app/models/session.py
from sqlalchemy import Column, String, DateTime, JSON, Enum
from app.models.base import Base
import enum

class SessionStatus(str, enum.Enum):
    ACTIVE = "active"
    ENDED = "ended"
    EXPIRED = "expired"

class Session(Base):
    __tablename__ = "sessions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(100), unique=True, nullable=False)
    organization_id = Column(UUID(as_uuid=True), nullable=False)
    status = Column(Enum(SessionStatus), default=SessionStatus.ACTIVE)
    business_context = Column(JSON, nullable=False)
    config = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at = Column(DateTime(timezone=True), nullable=True)
```

2. **Implement Session Manager** (Days 2-3)
```python
# backend/app/services/session_manager.py
class SessionManager:
    def __init__(self, db: AsyncSession, redis: RedisClient):
        self.db = db
        self.redis = redis
    
    async def create_session(
        self,
        organization_id: str,
        business_context: dict,
        config: dict
    ) -> Session:
        # Generate session ID
        session_id = f"sess_{uuid.uuid4().hex[:12]}"
        
        # Create database record
        session = Session(
            session_id=session_id,
            organization_id=organization_id,
            business_context=business_context,
            config=config,
            status=SessionStatus.ACTIVE,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(
                minutes=config.get('timeout_minutes', 30)
            )
        )
        
        self.db.add(session)
        await self.db.commit()
        await self.db.refresh(session)
        
        # Cache in Redis
        await self.redis.hset(
            f"session:{session_id}",
            mapping={
                "status": session.status.value,
                "created_at": session.created_at.isoformat()
            }
        )
        await self.redis.expire(f"session:{session_id}", 1800)
        
        return session
```

3. **Create API Endpoints** (Day 4)
```python
# backend/app/api/sessions.py
from fastapi import APIRouter, Depends, HTTPException
from app.services.session_manager import SessionManager
from app.schemas.session import CreateSessionRequest, SessionResponse

router = APIRouter(prefix="/v1/sessions", tags=["sessions"])

@router.post("", response_model=SessionResponse, status_code=201)
async def create_session(
    request: CreateSessionRequest,
    session_manager: SessionManager = Depends(get_session_manager)
):
    try:
        session = await session_manager.create_session(
            organization_id=request.organization_id,
            business_context=request.business_context.dict(),
            config=request.config.dict()
        )
        return SessionResponse.from_orm(session)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e))
```

4. **Write Tests** (Day 5)
```python
# tests/unit/test_session_manager.py
@pytest.mark.asyncio
async def test_create_session(db_session, redis_mock):
    manager = SessionManager(db=db_session, redis=redis_mock)
    
    session = await manager.create_session(
        organization_id="org_001",
        business_context={"type": "order", "id": "123"},
        config={"language": "en"}
    )
    
    assert session.session_id.startswith("sess_")
    assert session.status == SessionStatus.ACTIVE
```

### Week 4: WebSocket Communication

**Implementation Steps:**

1. **WebSocket Handler** (Days 1-2)
```python
# backend/app/api/websocket.py
from fastapi import WebSocket, WebSocketDisconnect
from app.services.event_router import EventRouter

@router.websocket("/ws/sessions/{session_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    session_id: str,
    token: str,
    event_router: EventRouter = Depends(get_event_router)
):
    # Authenticate
    participant = await authenticate_websocket(token)
    
    # Accept connection
    await websocket.accept()
    
    # Register connection
    connection_id = f"conn_{uuid.uuid4().hex[:12]}"
    await event_router.register_connection(
        session_id=session_id,
        participant_id=participant.participant_id,
        connection_id=connection_id,
        websocket=websocket
    )
    
    try:
        while True:
            # Receive message
            data = await websocket.receive_json()
            
            # Route event
            await event_router.route_event(
                session_id=session_id,
                sender_id=participant.participant_id,
                event=data
            )
    
    except WebSocketDisconnect:
        await event_router.unregister_connection(connection_id)
```

2. **Event Router** (Days 3-4)
```python
# backend/app/services/event_router.py
class EventRouter:
    def __init__(self, redis: RedisClient):
        self.redis = redis
        self.connections: Dict[str, WebSocket] = {}
    
    async def register_connection(
        self,
        session_id: str,
        participant_id: str,
        connection_id: str,
        websocket: WebSocket
    ):
        # Store connection
        self.connections[connection_id] = websocket
        
        # Map connection to participant
        await self.redis.set(
            f"connection:{connection_id}",
            participant_id,
            ex=300
        )
        
        # Subscribe to session events
        pubsub = self.redis.pubsub()
        await pubsub.subscribe(f"session:{session_id}:events")
        
        # Start listening
        asyncio.create_task(
            self._listen_events(pubsub, connection_id)
        )
    
    async def route_event(
        self,
        session_id: str,
        sender_id: str,
        event: dict
    ):
        # Validate event
        validated_event = EventSchema(**event)
        
        # Add metadata
        validated_event.event_id = f"evt_{uuid.uuid4().hex[:12]}"
        validated_event.timestamp = datetime.utcnow().isoformat()
        validated_event.sender_id = sender_id
        
        # Publish to session
        await self.redis.publish(
            f"session:{session_id}:events",
            validated_event.json()
        )
    
    async def _listen_events(self, pubsub, connection_id: str):
        async for message in pubsub.listen():
            if message['type'] == 'message':
                websocket = self.connections.get(connection_id)
                if websocket:
                    await websocket.send_text(message['data'])
```

3. **Frontend WebSocket Client** (Day 5)
```typescript
// frontend/src/services/websocket.ts
export class WebSocketClient {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Function[]> = new Map();
  
  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(url);
      
      this.ws.onopen = () => resolve();
      this.ws.onerror = (error) => reject(error);
      
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        this.emit(data.type, data);
      };
    });
  }
  
  on(eventType: string, callback: Function) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType)!.push(callback);
  }
  
  send(event: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }
  
  private emit(eventType: string, data: any) {
    const callbacks = this.listeners.get(eventType) || [];
    callbacks.forEach(callback => callback(data));
  }
}
```

### Week 5: Message Delivery

**Implementation Steps:**

1. **Message Models & Schemas** (Day 1)
2. **Message Service Implementation** (Days 2-3)
3. **API Endpoints** (Day 4)
4. **Integration Tests** (Day 5)

---

## Phase 2: Type-to-Voice (Weeks 6-7)

### Key Implementation Points

**TTS Integration:**
```python
# backend/app/services/speech_service.py
from google import generativeai as genai

class SpeechService:
    def __init__(self):
        genai.configure(api_key=settings.GEMINI_API_KEY)
        self.tts_model = genai.GenerativeModel('gemini-3.8-flash-lite-tts')
    
    async def generate_speech(
        self,
        text: str,
        language: str,
        voice: str = "default"
    ) -> bytes:
        try:
            response = await self.tts_model.generate_content(
                contents=[text],
                generation_config={
                    'language': language,
                    'voice': voice
                }
            )
            
            # Extract audio bytes
            audio_data = response.parts[0].audio
            
            # Upload to storage
            audio_url = await self.upload_audio(audio_data)
            
            return {
                'audio_url': audio_url,
                'duration_seconds': len(audio_data) / 24000,  # Assuming 24kHz
                'format': 'mp3'
            }
        
        except Exception as e:
            logger.error(f"TTS generation failed: {e}")
            raise TTSError("Failed to generate speech") from e
```

---

## Phase 3: Fluency Shield (Weeks 8-11)

### Critical Implementation Details

**Speech Reconstruction Logic:**
```python
# backend/app/services/fluency_shield.py
class FluencyShield:
    def __init__(self):
        self.model = genai.GenerativeModel('gemini-3.8-flash')
    
    async def reconstruct(
        self,
        transcript: str,
        language: str
    ) -> ReconstructionResult:
        # Construct prompt
        prompt = f"""
        You are a speech reconstruction assistant. Your task is to reconstruct 
        speech that may contain disfluencies while PRESERVING the original meaning.
        
        CRITICAL RULES:
        1. NEVER change negation (no, not, don't → must remain)
        2. NEVER change numbers, amounts, dates, or times
        3. NEVER change named entities (names, places, brands)
        4. NEVER change the intent (question → question, statement → statement)
        5. ONLY remove obvious repetitions and fillers
        6. If uncertain, mark as ambiguous
        
        Original transcript: "{transcript}"
        Language: {language}
        
        Return JSON:
        {{
          "original": "...",
          "reconstructed": "...",
          "disfluencies": [
            {{"type": "repetition", "span": [0, 5], "text": "I I"}}
          ],
          "confidence": 0.95,
          "warnings": [],
          "preservation_score": 1.0
        }}
        """
        
        response = await self.model.generate_content(
            contents=[prompt],
            generation_config={
                'response_mime_type': 'application/json'
            }
        )
        
        result = json.loads(response.text)
        
        # Validate semantic preservation
        if not self._validate_preservation(transcript, result['reconstructed']):
            result['warnings'].append("Semantic preservation may be incomplete")
            result['confidence'] *= 0.8
        
        return ReconstructionResult(**result)
    
    def _validate_preservation(self, original: str, reconstructed: str) -> bool:
        """Validate critical elements preserved"""
        # Check negation
        original_has_negation = any(
            neg in original.lower()
            for neg in ['no', 'not', "don't", "can't", "won't"]
        )
        reconstructed_has_negation = any(
            neg in reconstructed.lower()
            for neg in ['no', 'not', "don't", "can't", "won't"]
        )
        
        if original_has_negation != reconstructed_has_negation:
            return False
        
        # Check numbers preserved
        original_numbers = re.findall(r'\d+', original)
        reconstructed_numbers = re.findall(r'\d+', reconstructed)
        
        if set(original_numbers) != set(reconstructed_numbers):
            return False
        
        return True
```

**Customer Approval Workflow:**
```typescript
// frontend/src/features/fluency-shield/FluencyShield.tsx
export const FluencyShield: React.FC = () => {
  const [transcription, setTranscription] = useState<Transcription | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  
  const handleApprove = () => {
    const finalText = isEditing ? editedText : transcription.reconstructed;
    onApprove(finalText);
  };
  
  return (
    <div className="fluency-shield">
      <div className="transcript-original">
        <h3>Original</h3>
        <p>{transcription.original}</p>
      </div>
      
      <div className="transcript-reconstructed">
        <h3>Suggested</h3>
        {isEditing ? (
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
          />
        ) : (
          <p>{transcription.reconstructed}</p>
        )}
      </div>
      
      <div className="actions">
        <button onClick={() => setIsEditing(!isEditing)}>
          {isEditing ? 'Cancel Edit' : 'Edit'}
        </button>
        <button onClick={handleApprove} className="primary">
          Approve & Send
        </button>
        <button onClick={onReject}>
          Retry
        </button>
      </div>
    </div>
  );
};
```

---

## 3. Common Pitfalls

### Pitfall 1: Not Handling WebSocket Reconnection
```typescript
// BAD: No reconnection logic
const ws = new WebSocket(url);

// GOOD: Automatic reconnection
class ReconnectingWebSocket {
  private attemptReconnect() {
    setTimeout(() => {
      this.connect();
      this.attempts++;
      this.delay = Math.min(this.delay * 2, 30000);
    }, this.delay);
  }
}
```

### Pitfall 2: Not Validating AI Outputs
```python
# BAD: Trust AI blindly
reconstructed = await model.generate(transcript)
return reconstructed  # What if it changes meaning?

# GOOD: Validate preservation
result = await model.generate(transcript)
if not validate_semantic_preservation(original, result):
    result.warnings.append("Validation failed")
    result.confidence *= 0.5
return result
```

### Pitfall 3: Storing PII in Logs
```python
# BAD: Log everything
logger.info(f"Message received: {message.content.text}")

# GOOD: Redact PII
logger.info(f"Message received: {redact_pii(message.content.text)}")
```

### Pitfall 4: No Rate Limiting
```python
# BAD: No limits
@router.post("/transcribe")
async def transcribe(audio: bytes):
    return await speech_service.transcribe(audio)

# GOOD: Rate limited
@router.post("/transcribe")
@rate_limit(requests=30, window=60)
async def transcribe(audio: bytes, user_id: str = Depends(get_user_id)):
    return await speech_service.transcribe(audio)
```

---

## 4. Troubleshooting

### Issue: WebSocket keeps disconnecting

**Symptoms:**
- WebSocket disconnects every 30-60 seconds
- "Connection closed" errors

**Solution:**
```python
# Implement heartbeat/ping-pong
async def websocket_heartbeat(websocket: WebSocket):
    while True:
        try:
            await websocket.send_json({"type": "ping"})
            await asyncio.sleep(30)
        except:
            break
```

### Issue: AI service timeout

**Symptoms:**
- Requests to Gemini API timing out
- "504 Gateway Timeout" errors

**Solution:**
```python
# Add timeout and retry
async def transcribe_with_retry(audio: bytes, max_retries=3):
    for attempt in range(max_retries):
        try:
            async with asyncio.timeout(10):  # 10 second timeout
                return await gemini_api.transcribe(audio)
        except asyncio.TimeoutError:
            if attempt == max_retries - 1:
                raise
            await asyncio.sleep(2 ** attempt)  # Exponential backoff
```

### Issue: Gesture recognition not working

**Symptoms:**
- Gestures not detected
- Low confidence scores

**Solution:**
```python
# Check landmark quality
def validate_landmarks(landmarks: List[Landmark]) -> bool:
    # Check all landmarks present
    if len(landmarks) != 21:
        return False
    
    # Check confidence
    avg_confidence = sum(l.confidence for l in landmarks) / len(landmarks)
    if avg_confidence < 0.7:
        return False
    
    # Check hand is visible (not too far)
    hand_size = calculate_hand_size(landmarks)
    if hand_size < 0.1:  # Too small
        return False
    
    return True
```

---

## 5. Performance Optimization

### Database Query Optimization

```python
# BAD: N+1 query problem
sessions = await db.query(Session).all()
for session in sessions:
    participants = await db.query(Participant).filter_by(
        session_id=session.id
    ).all()

# GOOD: Eager loading
sessions = await db.query(Session).options(
    selectinload(Session.participants)
).all()
```

### Caching Strategy

```python
# Cache frequently accessed data
class SessionCache:
    async def get_session(self, session_id: str) -> Optional[Session]:
        # Try cache first
        cached = await redis.get(f"session:{session_id}")
        if cached:
            return Session.parse_raw(cached)
        
        # Fallback to database
        session = await db.query(Session).filter_by(
            session_id=session_id
        ).first()
        
        if session:
            # Cache for 5 minutes
            await redis.setex(
                f"session:{session_id}",
                300,
                session.json()
            )
        
        return session
```

---

## 6. Deployment Guide

### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: interact_dev
      POSTGRES_USER: interact
      POSTGRES_PASSWORD: interact
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
  
  redis:
    image: redis:7
    ports:
      - "6379:6379"
  
  backend:
    build: ./backend
    command: uvicorn app.main:app --host 0.0.0.0 --reload
    volumes:
      - ./backend:/app
    ports:
      - "8000:8000"
    environment:
      DATABASE_URL: postgresql://interact:interact@postgres:5432/interact_dev
      REDIS_URL: redis://redis:6379/0
    depends_on:
      - postgres
      - redis
  
  frontend:
    build: ./frontend
    command: npm run dev
    volumes:
      - ./frontend:/app
      - /app/node_modules
    ports:
      - "3000:3000"
    environment:
      VITE_API_URL: http://localhost:8000/v1

volumes:
  postgres_data:
```

### Kubernetes (Production)

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: interact-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: interact-backend
  template:
    metadata:
      labels:
        app: interact-backend
    spec:
      containers:
      - name: backend
        image: interact-backend:latest
        ports:
        - containerPort: 8000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: interact-secrets
              key: database-url
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
```

---

**Document Status:** Ready for Implementation  
**Recommended:** Start with Phase 0 and follow sequentially  
**Support:** Refer to other documents for detailed specifications
