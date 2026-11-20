# InterACT — API Specifications

**Version:** 1.0  
**Base URL:** `https://api.interact.example.com/v1`  
**WebSocket URL:** `wss://api.interact.example.com/v1/ws`

---

## Table of Contents
1. [Authentication](#authentication)
2. [REST API Endpoints](#rest-api-endpoints)
3. [WebSocket Protocol](#websocket-protocol)
4. [Event Schemas](#event-schemas)
5. [Error Responses](#error-responses)
6. [Rate Limiting](#rate-limiting)

---

## 1. Authentication

### 1.1 Authentication Methods

**JWT Bearer Token:**
```http
Authorization: Bearer <jwt_token>
```

**Token Structure:**
```json
{
  "sub": "user_id",
  "role": "customer|agent|admin",
  "org_id": "org_123",
  "session_id": "sess_456",
  "exp": 1700000000,
  "iat": 1699996400
}
```

### 1.2 Obtain Token (Demo Mode)

```http
POST /v1/auth/demo-token
Content-Type: application/json

{
  "role": "customer|agent",
  "session_id": "sess_demo_001"
}
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "expires_in": 3600
}
```

---

## 2. REST API Endpoints

### 2.1 Session Management

#### Create Session

```http
POST /v1/sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "organization_id": "org_001",
  "business_context": {
    "type": "order",
    "id": "order_123",
    "data": {
      "order_id": "ZMT-4092",
      "items": ["Paneer Tikka"],
      "status": "delivered",
      "amount": 320
    }
  },
  "config": {
    "language": "en",
    "features": ["fluency_shield", "gestures", "smart_chips"],
    "timeout_minutes": 30
  }
}
```

**Response (201 Created):**
```json
{
  "session_id": "sess_abc123def456",
  "status": "active",
  "created_at": "2026-11-20T10:00:00Z",
  "join_url": "https://app.interact.example.com/session/sess_abc123def456",
  "websocket_url": "wss://api.interact.example.com/v1/ws/sessions/sess_abc123def456",
  "expires_at": "2026-11-20T10:30:00Z"
}
```

#### Get Session

```http
GET /v1/sessions/{session_id}
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "session_id": "sess_abc123def456",
  "organization_id": "org_001",
  "status": "active",
  "participants": [
    {
      "participant_id": "part_001",
      "role": "customer",
      "joined_at": "2026-11-20T10:00:05Z",
      "connection_status": "connected"
    },
    {
      "participant_id": "part_002",
      "role": "agent",
      "joined_at": "2026-11-20T10:00:15Z",
      "connection_status": "connected"
    }
  ],
  "business_context": { ... },
  "created_at": "2026-11-20T10:00:00Z",
  "expires_at": "2026-11-20T10:30:00Z"
}
```

#### Join Session

```http
POST /v1/sessions/{session_id}/join
Authorization: Bearer <token>
Content-Type: application/json

{
  "participant_id": "part_001",
  "role": "customer",
  "preferences": {
    "language": "en",
    "voice": "en-US-Neural2-C",
    "features": ["fluency_shield", "gestures"]
  }
}
```

**Response (200 OK):**
```json
{
  "participant_id": "part_001",
  "session_id": "sess_abc123def456",
  "role": "customer",
  "joined_at": "2026-11-20T10:00:05Z",
  "websocket_token": "ws_token_xyz789",
  "websocket_url": "wss://api.interact.example.com/v1/ws/sessions/sess_abc123def456?token=ws_token_xyz789"
}
```

#### End Session

```http
POST /v1/sessions/{session_id}/end
Authorization: Bearer <token>
Content-Type: application/json

{
  "ended_by": "part_002",
  "reason": "resolved"
}
```

**Response (200 OK):**
```json
{
  "session_id": "sess_abc123def456",
  "status": "ended",
  "ended_at": "2026-11-20T10:15:30Z",
  "ended_by": "part_002",
  "duration_seconds": 925
}
```

### 2.2 Message Management

#### Send Message (HTTP Fallback)

```http
POST /v1/sessions/{session_id}/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "sender_id": "part_001",
  "source": "text",
  "content": {
    "text": "I need help with my order",
    "language": "en"
  }
}
```

**Response (201 Created):**
```json
{
  "message_id": "msg_001",
  "session_id": "sess_abc123def456",
  "sender_id": "part_001",
  "created_at": "2026-11-20T10:05:00Z",
  "status": "delivered"
}
```

#### Get Messages

```http
GET /v1/sessions/{session_id}/messages?limit=50&before=msg_100
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "messages": [
    {
      "message_id": "msg_001",
      "sender_id": "part_001",
      "sender_role": "customer",
      "source": "text",
      "content": {
        "text": "I need help with my order",
        "language": "en"
      },
      "created_at": "2026-11-20T10:05:00Z",
      "delivered_at": "2026-11-20T10:05:00.123Z"
    }
  ],
  "pagination": {
    "has_more": true,
    "next_cursor": "msg_002"
  }
}
```

### 2.3 Speech Services

#### Transcribe Audio

```http
POST /v1/speech/transcribe
Authorization: Bearer <token>
Content-Type: multipart/form-data

audio: <audio_file.webm>
language: en
```

**Response (200 OK):**
```json
{
  "transcript": "I I need to block my card",
  "language": "en",
  "confidence": 0.92,
  "duration_seconds": 3.5,
  "timestamps": [
    {"word": "I", "start": 0.0, "end": 0.2},
    {"word": "I", "start": 0.3, "end": 0.5},
    {"word": "need", "start": 0.6, "end": 0.9}
  ]
}
```

#### Reconstruct Speech (Fluency Shield)

```http
POST /v1/speech/reconstruct
Authorization: Bearer <token>
Content-Type: application/json

{
  "transcript": "I I need to block my card",
  "language": "en",
  "context": {
    "session_id": "sess_abc123def456"
  }
}
```

**Response (200 OK):**
```json
{
  "original": "I I need to block my card",
  "reconstructed": "I need to block my card",
  "disfluencies": [
    {
      "type": "repetition",
      "span": [0, 1],
      "text": "I"
    }
  ],
  "confidence": 0.95,
  "preservation_score": 1.0,
  "warnings": []
}
```

#### Generate Speech (TTS)

```http
POST /v1/speech/synthesize
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "I need to block my card",
  "language": "en",
  "voice": "en-US-Neural2-C",
  "speed": 1.0
}
```

**Response (200 OK):**
```json
{
  "audio_url": "https://cdn.interact.example.com/audio/abc123.mp3",
  "duration_seconds": 2.1,
  "format": "mp3",
  "sample_rate": 24000,
  "expires_at": "2026-11-20T11:00:00Z"
}
```

### 2.4 Gesture Management

#### Enroll Gesture

```http
POST /v1/gestures/enroll
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "user_001",
  "gesture_name": "thumbs_up",
  "phrase": "Yes, I confirm",
  "samples": [
    {
      "landmarks": [
        {"x": 0.5, "y": 0.3, "z": 0.0},
        // ... 21 landmarks
      ],
      "handedness": "right",
      "confidence": 0.98
    }
    // 5-10 samples recommended
  ]
}
```

**Response (201 Created):**
```json
{
  "gesture_id": "gest_001",
  "user_id": "user_001",
  "name": "thumbs_up",
  "phrase": "Yes, I confirm",
  "samples_count": 7,
  "created_at": "2026-11-20T10:00:00Z"
}
```

#### Match Gesture

```http
POST /v1/gestures/match
Authorization: Bearer <token>
Content-Type: application/json

{
  "user_id": "user_001",
  "landmarks": {
    "landmarks": [ /* 21 landmarks */ ],
    "handedness": "right",
    "confidence": 0.97
  }
}
```

**Response (200 OK):**
```json
{
  "matched": true,
  "gesture_id": "gest_001",
  "gesture_name": "thumbs_up",
  "phrase": "Yes, I confirm",
  "confidence": 0.89,
  "matched_at": "2026-11-20T10:05:23Z"
}
```

**Response (200 OK - No Match):**
```json
{
  "matched": false,
  "confidence": 0.42,
  "message": "No gesture matched above confidence threshold"
}
```

#### List Gestures

```http
GET /v1/gestures?user_id=user_001
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "gestures": [
    {
      "gesture_id": "gest_001",
      "name": "thumbs_up",
      "phrase": "Yes, I confirm",
      "created_at": "2026-11-20T10:00:00Z"
    },
    {
      "gesture_id": "gest_002",
      "name": "open_palm",
      "phrase": "Please wait",
      "created_at": "2026-11-20T10:01:00Z"
    }
  ]
}
```

### 2.5 Smart Response Generation

#### Generate Context-Aware Responses

```http
POST /v1/responses/generate
Authorization: Bearer <token>
Content-Type: application/json

{
  "session_id": "sess_abc123def456",
  "business_context": {
    "type": "order",
    "data": {
      "order_id": "ZMT-4092",
      "status": "delivered",
      "items": ["Paneer Tikka"],
      "amount": 320
    }
  },
  "conversation_history": [
    {
      "role": "agent",
      "content": "How can I help you today?"
    }
  ],
  "latest_message": "There is a missing item in my order",
  "language": "en",
  "count": 4
}
```

**Response (200 OK):**
```json
{
  "responses": [
    {
      "id": "resp_1",
      "text": "The Paneer Tikka is missing from my order",
      "style": "specific",
      "grounded_facts": ["items", "order_id"]
    },
    {
      "id": "resp_2",
      "text": "I didn't receive everything I ordered",
      "style": "general",
      "grounded_facts": ["order_id"]
    },
    {
      "id": "resp_3",
      "text": "An item is missing, can you help?",
      "style": "polite",
      "grounded_facts": []
    },
    {
      "id": "resp_4",
      "text": "My order is incomplete",
      "style": "brief",
      "grounded_facts": ["order_id"]
    }
  ],
  "context_version": "v1",
  "generated_at": "2026-11-20T10:05:15Z"
}
```

### 2.6 Visual Cards

#### Send Visual Card

```http
POST /v1/sessions/{session_id}/cards
Authorization: Bearer <token>
Content-Type: application/json

{
  "sender_id": "part_002",
  "card_type": "refund_info",
  "data": {
    "title": "Refund Initiated",
    "amount": 320,
    "currency": "INR",
    "method": "Original payment method",
    "estimated_days": "3-5 business days",
    "reference": "REF-123456"
  }
}
```

**Response (201 Created):**
```json
{
  "card_id": "card_001",
  "session_id": "sess_abc123def456",
  "sender_id": "part_002",
  "card_type": "refund_info",
  "created_at": "2026-11-20T10:10:00Z"
}
```

### 2.7 Health & Status

#### Health Check

```http
GET /v1/health
```

**Response (200 OK):**
```json
{
  "status": "healthy",
  "timestamp": "2026-11-20T10:00:00Z",
  "version": "1.0.0",
  "services": {
    "database": "healthy",
    "redis": "healthy",
    "gemini_api": "healthy"
  }
}
```

#### Service Status

```http
GET /v1/status
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "active_sessions": 127,
  "connected_participants": 254,
  "websocket_connections": 254,
  "messages_per_second": 45,
  "ai_service_latency_ms": {
    "p50": 1234,
    "p95": 2456,
    "p99": 3789
  }
}
```

---

## 3. WebSocket Protocol

### 3.1 Connection

**URL:** `wss://api.interact.example.com/v1/ws/sessions/{session_id}`

**Query Parameters:**
```
?token=<websocket_token>
```

**Connection Flow:**
```javascript
const ws = new WebSocket(
  'wss://api.interact.example.com/v1/ws/sessions/sess_abc123def456?token=ws_token_xyz789'
);

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleEvent(message);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
  // Implement reconnection logic
};
```

### 3.2 Message Format

**Client → Server:**
```json
{
  "type": "message.send",
  "message_id": "msg_client_001",
  "payload": {
    "source": "text",
    "content": {
      "text": "Hello",
      "language": "en"
    }
  }
}
```

**Server → Client:**
```json
{
  "type": "message.received",
  "event_id": "evt_001",
  "timestamp": "2026-11-20T10:05:00.123Z",
  "payload": {
    "message_id": "msg_001",
    "sender_id": "part_002",
    "sender_role": "agent",
    "source": "text",
    "content": {
      "text": "How can I help you?",
      "language": "en"
    }
  }
}
```

### 3.3 Event Types

#### Client Events (Client → Server)

```typescript
// Send message
{
  type: "message.send"
  payload: MessageContent
}

// Update activity status
{
  type: "activity.update"
  payload: {
    activity: "typing" | "recording" | "reviewing" | "idle"
  }
}

// Heartbeat/ping
{
  type: "ping"
  timestamp: string
}
```

#### Server Events (Server → Client)

```typescript
// Message received
{
  type: "message.received"
  payload: Message
}

// Participant joined
{
  type: "participant.joined"
  payload: Participant
}

// Participant left
{
  type: "participant.left"
  payload: { participant_id: string }
}

// Participant activity
{
  type: "participant.activity"
  payload: {
    participant_id: string
    activity: ActivityType
    timestamp: string
  }
}

// Speech transcribed
{
  type: "speech.transcribed"
  payload: TranscriptionResult
}

// Speech reconstructed
{
  type: "speech.reconstructed"
  payload: ReconstructionResult
}

// Responses generated
{
  type: "responses.generated"
  payload: ResponseOptions
}

// Visual card received
{
  type: "card.received"
  payload: VisualCard
}

// Session ended
{
  type: "session.ended"
  payload: {
    ended_by: string
    reason: string
    timestamp: string
  }
}

// Error
{
  type: "error"
  payload: {
    error_id: string
    message: string
    code: string
  }
}

// Pong (heartbeat response)
{
  type: "pong"
  timestamp: string
}
```

### 3.4 Reconnection Protocol

```javascript
class ReconnectingWebSocket {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000; // Start with 1 second
  
  connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onclose = () => {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        setTimeout(() => {
          this.reconnectAttempts++;
          this.reconnectDelay *= 2; // Exponential backoff
          this.connect();
        }, this.reconnectDelay);
      }
    };
    
    this.ws.onopen = () => {
      this.reconnectAttempts = 0;
      this.reconnectDelay = 1000;
      // Request missed events
      this.requestMissedEvents();
    };
  }
  
  requestMissedEvents() {
    this.ws.send(JSON.stringify({
      type: "events.replay",
      after_event_id: this.lastEventId
    }));
  }
}
```

---

## 4. Event Schemas

### 4.1 Base Event Schema

```typescript
interface BaseEvent {
  event_id: string;
  schema_version: "1.0";
  session_id: string;
  event_type: EventType;
  timestamp: string; // ISO 8601
  sender: {
    participant_id: string;
    role: "customer" | "agent";
  };
  payload: Record<string, any>;
}
```

### 4.2 Message Events

```typescript
interface MessageCreatedEvent extends BaseEvent {
  event_type: "message.created";
  payload: {
    message_id: string;
    source: "text" | "speech" | "gesture" | "smart_chip";
    content: {
      text: string;
      language: string;
      audio_url?: string;
      original_text?: string; // For Fluency Shield
    };
    metadata: {
      device_type?: string;
      client_version?: string;
    };
  };
}

interface MessageReceivedEvent extends BaseEvent {
  event_type: "message.received";
  payload: {
    message_id: string;
    sender_id: string;
    sender_role: "customer" | "agent";
    source: "text" | "speech" | "gesture" | "smart_chip";
    content: {
      text: string;
      language: string;
      audio_url?: string;
    };
    received_at: string;
  };
}
```

### 4.3 Speech Events

```typescript
interface SpeechTranscribedEvent extends BaseEvent {
  event_type: "speech.transcribed";
  payload: {
    transcript: string;
    language: string;
    confidence: number;
    duration_seconds: number;
  };
}

interface SpeechReconstructedEvent extends BaseEvent {
  event_type: "speech.reconstructed";
  payload: {
    original: string;
    reconstructed: string;
    disfluencies: Disfluency[];
    confidence: number;
    requires_approval: boolean;
  };
}

interface SpeechApprovedEvent extends BaseEvent {
  event_type: "speech.approved";
  payload: {
    approved_text: string;
    was_edited: boolean;
  };
}
```

### 4.4 Gesture Events

```typescript
interface GestureDetectedEvent extends BaseEvent {
  event_type: "gesture.detected";
  payload: {
    gesture_id: string;
    gesture_name: string;
    phrase: string;
    confidence: number;
    requires_confirmation: boolean;
  };
}

interface GestureApprovedEvent extends BaseEvent {
  event_type: "gesture.approved";
  payload: {
    gesture_id: string;
    phrase: string;
  };
}
```

### 4.5 Activity Events

```typescript
interface ParticipantActivityEvent extends BaseEvent {
  event_type: "participant.activity";
  payload: {
    participant_id: string;
    activity: "typing" | "recording" | "transcribing" | "reviewing" | "sending" | "idle";
    timestamp: string;
    expires_at: string;
  };
}
```

---

## 5. Error Responses

### 5.1 Error Format

```json
{
  "error": {
    "error_id": "err_abc123",
    "code": "VALIDATION_ERROR",
    "message": "Invalid session_id format",
    "details": {
      "field": "session_id",
      "expected": "sess_[a-z0-9]+",
      "received": "invalid_id"
    },
    "retry_after": null,
    "support_reference": "https://docs.interact.example.com/errors/VALIDATION_ERROR"
  }
}
```

### 5.2 Error Codes

| Code | HTTP Status | Description | Retry |
|------|-------------|-------------|-------|
| `VALIDATION_ERROR` | 400 | Invalid request parameters | No |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid token | No |
| `AUTHORIZATION_FAILED` | 403 | Insufficient permissions | No |
| `RESOURCE_NOT_FOUND` | 404 | Session/message not found | No |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Yes, after `retry_after` |
| `INTERNAL_ERROR` | 500 | Server error | Yes, with backoff |
| `AI_SERVICE_ERROR` | 503 | Gemini API unavailable | Yes, with backoff |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily down | Yes, after `retry_after` |
| `TIMEOUT` | 504 | Request timeout | Yes, with backoff |

### 5.3 Validation Errors

```json
{
  "error": {
    "error_id": "err_def456",
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "errors": [
        {
          "field": "business_context.data.amount",
          "message": "Must be a positive number",
          "code": "INVALID_TYPE"
        },
        {
          "field": "config.language",
          "message": "Unsupported language: 'fr'",
          "code": "INVALID_VALUE"
        }
      ]
    }
  }
}
```

---

## 6. Rate Limiting

### 6.1 Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1700000060
```

### 6.2 Rate Limit Response

```json
{
  "error": {
    "error_id": "err_rate_001",
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 45 seconds.",
    "retry_after": 45,
    "details": {
      "limit": 100,
      "window": "1 minute",
      "resets_at": "2026-11-20T10:01:00Z"
    }
  }
}
```

### 6.3 Rate Limit Tiers

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /sessions` | 10 | per user per hour |
| `POST /speech/transcribe` | 30 | per user per minute |
| `POST /speech/synthesize` | 30 | per user per minute |
| `POST /responses/generate` | 20 | per user per minute |
| `GET /sessions/*` | 100 | per user per minute |
| WebSocket messages | 120 | per connection per minute |

---

## Appendix A: TypeScript SDK Types

```typescript
// Client initialization
interface InterACTConfig {
  baseUrl: string;
  apiKey?: string;
  timeout?: number;
}

// Session creation
interface CreateSessionParams {
  organizationId: string;
  businessContext: BusinessContext;
  config: SessionConfig;
}

interface BusinessContext {
  type: string;
  id: string;
  data: Record<string, any>;
}

interface SessionConfig {
  language: string;
  features: Feature[];
  timeoutMinutes: number;
}

type Feature = "fluency_shield" | "gestures" | "smart_chips" | "visual_cards";

// Session response
interface Session {
  sessionId: string;
  status: "active" | "ended" | "expired";
  createdAt: string;
  joinUrl: string;
  websocketUrl: string;
  expiresAt: string;
}

// Event handler types
type EventHandler<T = any> = (event: T) => void;

interface EventMap {
  "message.received": MessageReceivedEvent;
  "participant.joined": ParticipantJoinedEvent;
  "participant.left": ParticipantLeftEvent;
  "participant.activity": ParticipantActivityEvent;
  "speech.transcribed": SpeechTranscribedEvent;
  "speech.reconstructed": SpeechReconstructedEvent;
  "gesture.detected": GestureDetectedEvent;
  "responses.generated": ResponsesGeneratedEvent;
  "card.received": CardReceivedEvent;
  "session.ended": SessionEndedEvent;
  "connection.state": ConnectionStateEvent;
  "error": ErrorEvent;
}
```

---

## Appendix B: Example Integration

```typescript
import { InterACT } from '@interact/accessibility-sdk';

// Initialize
const interact = new InterACT({
  baseUrl: 'https://api.interact.example.com/v1',
  apiKey: 'demo_key_123'
});

// Create session
const session = await interact.sessions.create({
  organizationId: 'org_001',
  businessContext: {
    type: 'order',
    id: 'order_123',
    data: {
      orderId: 'ZMT-4092',
      items: ['Paneer Tikka'],
      status: 'delivered'
    }
  },
  config: {
    language: 'en',
    features: ['fluency_shield', 'gestures', 'smart_chips'],
    timeoutMinutes: 30
  }
});

// Join session
const participant = await interact.sessions.join(session.sessionId, {
  participantId: 'part_001',
  role: 'customer',
  preferences: {
    language: 'en',
    features: ['fluency_shield']
  }
});

// Connect WebSocket
await interact.connect(participant.websocketUrl);

// Subscribe to events
interact.on('message.received', (event) => {
  console.log('New message:', event.payload.content.text);
});

interact.on('participant.activity', (event) => {
  console.log('Participant activity:', event.payload.activity);
});

// Send message
await interact.messages.send({
  source: 'text',
  content: {
    text: 'Hello, I need help',
    language: 'en'
  }
});

// End session
await interact.sessions.end(session.sessionId);
```

---

**Document Status:** Ready for Implementation  
**OpenAPI Spec:** Available at `/docs` endpoint when server is running
