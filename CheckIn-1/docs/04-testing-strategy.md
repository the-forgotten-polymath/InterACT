# InterACT — Testing Strategy

**Version:** 1.0  
**Last Updated:** November 20, 2026

---

## Table of Contents
1. [Testing Philosophy](#testing-philosophy)
2. [Test Coverage Requirements](#test-coverage-requirements)
3. [Unit Testing](#unit-testing)
4. [Integration Testing](#integration-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [Performance Testing](#performance-testing)
7. [Accessibility Testing](#accessibility-testing)
8. [AI Model Evaluation](#ai-model-evaluation)
9. [Security Testing](#security-testing)
10. [Test Data Management](#test-data-management)

---

## 1. Testing Philosophy

### 1.1 Testing Pyramid

```
           ╱╲
          ╱E2E╲          ← 10% (Critical user journeys)
         ╱─────╲
        ╱  INT  ╲        ← 30% (Service integration)
       ╱─────────╲
      ╱   UNIT    ╲      ← 60% (Business logic)
     ╱─────────────╲
```

### 1.2 Test-Driven Principles

1. **Write tests first** for critical features (Fluency Shield, Gesture Recognition)
2. **Test behavior, not implementation**
3. **Fast feedback loop** - unit tests run in < 10 seconds
4. **Deterministic** - no flaky tests
5. **Isolated** - tests don't depend on each other
6. **Maintainable** - clear, readable test code

### 1.3 Quality Gates

```yaml
Pre-Commit:
  - Linting passes (eslint, pylint)
  - Type checking passes (mypy, tsc)
  - Unit tests pass
  - Code formatting (prettier, black)

Pre-Push:
  - All unit tests pass
  - Integration tests pass
  - Test coverage >= 80%

Pull Request:
  - All tests pass
  - No security vulnerabilities (Snyk, Dependabot)
  - Code review approved
  - Documentation updated

Pre-Deploy (Staging):
  - All tests pass
  - E2E tests pass
  - Performance benchmarks met
  - Accessibility audit passes

Pre-Deploy (Production):
  - Staging tests pass
  - Load tests pass
  - Security scan passes
  - Rollback plan validated
```

---

## 2. Test Coverage Requirements

### 2.1 Coverage Targets

| Component | Target | Critical Paths |
|-----------|--------|----------------|
| Business Logic | 90%+ | 100% |
| API Endpoints | 85%+ | 95% |
| Event Handlers | 85%+ | 95% |
| AI Service Integration | 80%+ | 90% |
| UI Components | 70%+ | 85% |
| Utility Functions | 85%+ | N/A |

### 2.2 Critical Paths (100% Coverage Required)

- Session creation and lifecycle
- Message delivery pipeline
- Speech transcription and reconstruction
- Customer approval workflow
- Gesture enrollment and matching
- Response generation with grounding
- WebSocket connection and reconnection
- Authentication and authorization
- PII handling and redaction
- Error handling and fallbacks

---

## 3. Unit Testing

### 3.1 Backend Unit Tests (Python/Pytest)

```python
# tests/unit/services/test_session_manager.py

import pytest
from unittest.mock import Mock, AsyncMock
from app.services.session_manager import SessionManager
from app.models.session import Session, SessionStatus

@pytest.fixture
def session_manager():
    redis_mock = AsyncMock()
    db_mock = AsyncMock()
    return SessionManager(redis=redis_mock, db=db_mock)

class TestSessionManager:
    
    @pytest.mark.asyncio
    async def test_create_session_success(self, session_manager):
        """Should create session with valid business context"""
        # Arrange
        context = {
            "type": "order",
            "id": "order_123",
            "data": {"order_id": "ZMT-4092"}
        }
        config = {"language": "en", "timeout_minutes": 30}
        
        # Act
        session = await session_manager.create_session(
            organization_id="org_001",
            business_context=context,
            config=config
        )
        
        # Assert
        assert session.status == SessionStatus.ACTIVE
        assert session.business_context == context
        assert session.config == config
        assert session.session_id.startswith("sess_")
    
    @pytest.mark.asyncio
    async def test_create_session_invalid_context(self, session_manager):
        """Should raise ValidationError for invalid context"""
        # Arrange
        invalid_context = {"type": "invalid"}
        
        # Act & Assert
        with pytest.raises(ValidationError):
            await session_manager.create_session(
                organization_id="org_001",
                business_context=invalid_context,
                config={}
            )
    
    @pytest.mark.asyncio
    async def test_end_session_unauthorized(self, session_manager):
        """Should raise AuthorizationError if participant unauthorized"""
        # Arrange
        session = Mock(session_id="sess_123")
        unauthorized_participant = "part_999"
        
        # Act & Assert
        with pytest.raises(AuthorizationError):
            await session_manager.end_session(
                session_id=session.session_id,
                ended_by=unauthorized_participant
            )
```

### 3.2 Frontend Unit Tests (TypeScript/Vitest)

```typescript
// tests/unit/features/fluency-shield/FlucencyShield.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FluencyShield } from '@/features/fluency-shield/FluencyShield';

describe('FluencyShield', () => {
  
  it('should show original and reconstructed transcripts', async () => {
    // Arrange
    const mockTranscription = {
      original: 'I I need to block my card',
      reconstructed: 'I need to block my card'
    };
    
    // Act
    render(<FluencyShield transcription={mockTranscription} />);
    
    // Assert
    expect(screen.getByText(/I I need to block my card/)).toBeInTheDocument();
    expect(screen.getByText(/I need to block my card/)).toBeInTheDocument();
  });
  
  it('should require explicit approval before sending', async () => {
    // Arrange
    const onApprove = vi.fn();
    const mockTranscription = {
      original: 'I I need help',
      reconstructed: 'I need help'
    };
    
    // Act
    render(
      <FluencyShield 
        transcription={mockTranscription}
        onApprove={onApprove}
      />
    );
    
    // Assert - message not sent automatically
    expect(onApprove).not.toHaveBeenCalled();
    
    // Act - click approve
    await userEvent.click(screen.getByRole('button', { name: /approve/i }));
    
    // Assert - callback invoked
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('I need help');
    });
  });
  
  it('should allow editing reconstructed text', async () => {
    // Arrange
    const onApprove = vi.fn();
    
    // Act
    render(<FluencyShield transcription={mockData} onApprove={onApprove} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editButton);
    
    const textarea = screen.getByRole('textbox');
    await userEvent.clear(textarea);
    await userEvent.type(textarea, 'My custom edited text');
    
    const approveButton = screen.getByRole('button', { name: /approve/i });
    await userEvent.click(approveButton);
    
    // Assert - edited text sent
    await waitFor(() => {
      expect(onApprove).toHaveBeenCalledWith('My custom edited text');
    });
  });
});
```

### 3.3 Test Data Builders

```python
# tests/builders/session_builder.py

class SessionBuilder:
    """Builder pattern for test session creation"""
    
    def __init__(self):
        self.session = Session(
            session_id=f"sess_test_{uuid.uuid4().hex[:12]}",
            organization_id="org_test_001",
            status=SessionStatus.ACTIVE,
            business_context={},
            config={},
            created_at=datetime.utcnow()
        )
    
    def with_order_context(self, order_id: str, amount: int):
        self.session.business_context = {
            "type": "order",
            "id": order_id,
            "data": {"order_id": order_id, "amount": amount}
        }
        return self
    
    def with_participants(self, *roles: str):
        # Add participant logic
        return self
    
    def ended(self):
        self.session.status = SessionStatus.ENDED
        self.session.ended_at = datetime.utcnow()
        return self
    
    def build(self) -> Session:
        return self.session

# Usage
session = (SessionBuilder()
    .with_order_context("ZMT-4092", 320)
    .with_participants("customer", "agent")
    .build())
```

---

## 4. Integration Testing

### 4.1 API Integration Tests

```python
# tests/integration/test_session_api.py

import pytest
from httpx import AsyncClient
from app.main import app

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def auth_token():
    # Generate test JWT token
    return "test_token_123"

class TestSessionAPI:
    
    @pytest.mark.asyncio
    async def test_create_and_join_session(self, client, auth_token):
        """Test complete session creation and joining flow"""
        # Create session
        create_response = await client.post(
            "/v1/sessions",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "organization_id": "org_test_001",
                "business_context": {
                    "type": "order",
                    "id": "order_123",
                    "data": {"order_id": "ZMT-4092"}
                },
                "config": {"language": "en"}
            }
        )
        
        assert create_response.status_code == 201
        session_data = create_response.json()
        assert "session_id" in session_data
        
        session_id = session_data["session_id"]
        
        # Join session as customer
        join_response = await client.post(
            f"/v1/sessions/{session_id}/join",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "participant_id": "part_customer_001",
                "role": "customer",
                "preferences": {"language": "en"}
            }
        )
        
        assert join_response.status_code == 200
        participant_data = join_response.json()
        assert participant_data["session_id"] == session_id
        assert "websocket_url" in participant_data
    
    @pytest.mark.asyncio
    async def test_unauthorized_session_access(self, client):
        """Should deny access without valid token"""
        response = await client.get("/v1/sessions/sess_123")
        assert response.status_code == 401
```

### 4.2 WebSocket Integration Tests

```python
# tests/integration/test_websocket.py

import pytest
from websockets import connect

@pytest.mark.asyncio
async def test_websocket_message_delivery():
    """Test message delivery via WebSocket"""
    # Create session
    session_id = await create_test_session()
    
    # Connect two clients
    customer_ws = await connect(f"ws://test/v1/ws/sessions/{session_id}?token=customer_token")
    agent_ws = await connect(f"ws://test/v1/ws/sessions/{session_id}?token=agent_token")
    
    # Customer sends message
    await customer_ws.send(json.dumps({
        "type": "message.send",
        "payload": {
            "source": "text",
            "content": {"text": "Hello", "language": "en"}
        }
    }))
    
    # Agent should receive message
    message = await asyncio.wait_for(agent_ws.recv(), timeout=5)
    data = json.loads(message)
    
    assert data["type"] == "message.received"
    assert data["payload"]["content"]["text"] == "Hello"
    
    await customer_ws.close()
    await agent_ws.close()
```

### 4.3 AI Service Integration Tests

```python
# tests/integration/test_gemini_integration.py

import pytest
from app.services.speech_service import SpeechService

@pytest.mark.integration
@pytest.mark.asyncio
async def test_transcription_service():
    """Test real Gemini API transcription (runs in CI with API key)"""
    service = SpeechService()
    
    # Use test audio file
    with open("tests/fixtures/audio/test_speech.mp3", "rb") as f:
        audio_data = f.read()
    
    result = await service.transcribe(audio_data, language="en")
    
    assert result.transcript
    assert result.language == "en"
    assert 0 <= result.confidence <= 1
    assert result.duration_seconds > 0

@pytest.mark.integration
@pytest.mark.asyncio
async def test_fluency_shield_reconstruction():
    """Test Fluency Shield with real model"""
    service = SpeechService()
    
    transcript = "I I need to to block my my card"
    result = await service.reconstruct(transcript, language="en")
    
    assert result.original == transcript
    assert result.reconstructed != transcript  # Should be different
    assert "card" in result.reconstructed.lower()  # Preserve key terms
    assert len(result.disfluencies) > 0  # Should detect repetitions
```

---

## 5. End-to-End Testing

### 5.1 E2E Test Suite (Playwright)

```typescript
// tests/e2e/customer-agent-flow.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Customer-Agent Communication Flow', () => {
  
  test('complete session from customer text to agent receipt', async ({ browser }) => {
    // Setup: Create two browser contexts (customer and agent)
    const customerContext = await browser.newContext();
    const agentContext = await browser.newContext();
    
    const customerPage = await customerContext.newPage();
    const agentPage = await agentContext.newPage();
    
    // Customer opens app and starts session
    await customerPage.goto('http://localhost:3000/customer');
    await customerPage.click('text=Start Accessible Support');
    
    // Wait for session creation
    await customerPage.waitForURL(/\/session\/sess_/);
    const sessionUrl = customerPage.url();
    const sessionId = sessionUrl.match(/sess_[a-z0-9]+/)[0];
    
    // Agent joins same session
    await agentPage.goto(`http://localhost:3000/agent/sessions/${sessionId}`);
    await agentPage.click('text=Join Session');
    
    // Customer types and sends message
    await customerPage.fill('[data-testid="message-input"]', 'Hello, I need help');
    await customerPage.click('[data-testid="send-button"]');
    
    // Verify message appears in customer's view
    await expect(customerPage.locator('text=Hello, I need help')).toBeVisible();
    
    // Verify message appears in agent's view
    await expect(agentPage.locator('text=Hello, I need help')).toBeVisible({
      timeout: 5000
    });
    
    // Verify sender is labeled correctly
    const agentMessageElement = agentPage.locator('[data-testid="message"]').first();
    await expect(agentMessageElement).toContainText('Customer');
    
    // Cleanup
    await customerContext.close();
    await agentContext.close();
  });
  
  test('Fluency Shield workflow', async ({ page }) => {
    // Customer opens session
    await page.goto('http://localhost:3000/customer/session/sess_test_001');
    
    // Enable Fluency Shield
    await page.click('[data-testid="fluency-shield-toggle"]');
    
    // Start recording (mocked audio input)
    await page.click('[data-testid="record-button"]');
    await page.waitForTimeout(3000); // Simulate 3 seconds of recording
    await page.click('[data-testid="stop-recording"]');
    
    // Wait for transcription
    await page.waitForSelector('[data-testid="original-transcript"]', {
      timeout: 10000
    });
    
    // Verify both transcripts shown
    await expect(page.locator('[data-testid="original-transcript"]')).toBeVisible();
    await expect(page.locator('[data-testid="reconstructed-transcript"]')).toBeVisible();
    
    // Approve message
    await page.click('[data-testid="approve-button"]');
    
    // Verify message sent
    await expect(page.locator('[data-testid="message-sent-indicator"]')).toBeVisible();
  });
  
  test('Gesture macro triggers message', async ({ page }) => {
    // Setup: Enroll a gesture first (in real test, use pre-enrolled test user)
    await page.goto('http://localhost:3000/customer/gestures');
    
    // Navigate to active session
    await page.goto('http://localhost:3000/customer/session/sess_test_001');
    
    // Enable gesture mode
    await page.click('[data-testid="gesture-mode-toggle"]');
    
    // Grant camera permission (in test environment)
    await page.context().grantPermissions(['camera']);
    
    // Simulate gesture detection (in real test, need gesture simulation)
    // This would trigger gesture recognition
    
    // Verify gesture detected and phrase shown
    await expect(page.locator('[data-testid="detected-gesture"]')).toBeVisible({
      timeout: 5000
    });
    
    // Confirm gesture
    await page.click('[data-testid="confirm-gesture"]');
    
    // Verify message sent
    await expect(page.locator('text=Yes, I confirm')).toBeVisible();
  });
});
```

### 5.2 E2E Test Data Management

```typescript
// tests/e2e/fixtures/test-data.ts

export class E2ETestData {
  static async setupTestSession() {
    const response = await fetch('http://localhost:8000/v1/test/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationId: 'org_test_001',
        businessContext: {
          type: 'order',
          id: 'order_e2e_001',
          data: { orderId: 'ZMT-E2E-001', amount: 320 }
        }
      })
    });
    return await response.json();
  }
  
  static async cleanupTestSessions() {
    await fetch('http://localhost:8000/v1/test/sessions/cleanup', {
      method: 'DELETE'
    });
  }
}
```

---

## 6. Performance Testing

### 6.1 Load Testing (k6)

```javascript
// tests/performance/load-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import ws from 'k6/ws';

export let options = {
  stages: [
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 500 },  // Ramp up to 500 users
    { duration: '5m', target: 500 },  // Stay at 500 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<500', 'p(99)<1000'],
    'http_req_failed': ['rate<0.01'],
    'ws_connecting': ['p(95)<1000'],
  },
};

export default function () {
  // Create session
  let createRes = http.post(
    'http://localhost:8000/v1/sessions',
    JSON.stringify({
      organizationId: 'org_load_test',
      businessContext: { type: 'order', id: `order_${__VU}_${__ITER}` },
      config: { language: 'en' }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  
  check(createRes, {
    'session created': (r) => r.status === 201,
    'session_id present': (r) => r.json('session_id') !== '',
  });
  
  if (createRes.status !== 201) return;
  
  const sessionId = createRes.json('session_id');
  const wsUrl = `ws://localhost:8000/v1/ws/sessions/${sessionId}`;
  
  // Connect WebSocket
  const res = ws.connect(wsUrl, {}, function (socket) {
    socket.on('open', () => {
      // Send message every 2 seconds
      socket.setInterval(() => {
        socket.send(JSON.stringify({
          type: 'message.send',
          payload: {
            source: 'text',
            content: { text: 'Load test message', language: 'en' }
          }
        }));
      }, 2000);
    });
    
    socket.setTimeout(() => {
      socket.close();
    }, 30000); // Close after 30 seconds
  });
  
  check(res, { 'WebSocket connected': (r) => r && r.status === 101 });
  
  sleep(1);
}
```

### 6.2 Stress Testing

```javascript
// tests/performance/stress-test.js

export let options = {
  stages: [
    { duration: '1m', target: 1000 },   // Fast ramp to 1000
    { duration: '3m', target: 2000 },   // Push to 2000
    { duration: '2m', target: 3000 },   // Push to breaking point
    { duration: '2m', target: 0 },      // Ramp down
  ],
};

// Same test logic as load test
// Objective: Find breaking point
```

### 6.3 Latency Benchmarks

```python
# tests/performance/benchmark_ai_services.py

import asyncio
import time
from app.services.speech_service import SpeechService

async def benchmark_transcription():
    service = SpeechService()
    
    samples = []
    for _ in range(100):
        start = time.time()
        await service.transcribe(test_audio, language="en")
        duration = time.time() - start
        samples.append(duration)
    
    samples.sort()
    return {
        "p50": samples[49],
        "p95": samples[94],
        "p99": samples[98],
        "mean": sum(samples) / len(samples)
    }

# Target: p95 < 3 seconds, p99 < 5 seconds
```

---

## 7. Accessibility Testing

### 7.1 Automated Accessibility Tests

```typescript
// tests/a11y/accessibility.spec.ts

import { test, expect } from '@playwright/test';
import { injectAxe, checkA11y } from 'axe-playwright';

test.describe('Accessibility Compliance', () => {
  
  test('customer app should pass WCAG 2.1 AA', async ({ page }) => {
    await page.goto('http://localhost:3000/customer');
    await injectAxe(page);
    
    const results = await checkA11y(page, null, {
      detailedReport: true,
      detailedReportOptions: {
        html: true,
      },
    });
    
    expect(results.violations).toHaveLength(0);
  });
  
  test('all interactive elements should be keyboard accessible', async ({ page }) => {
    await page.goto('http://localhost:3000/customer/session/sess_test');
    
    // Tab through all interactive elements
    await page.keyboard.press('Tab');
    let focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    
    const focusableElements = ['BUTTON', 'INPUT', 'TEXTAREA', 'A'];
    expect(focusableElements).toContain(focusedElement);
    
    // Verify focus indicators visible
    const focusOutline = await page.evaluate(() => {
      const el = document.activeElement;
      return window.getComputedStyle(el).outlineWidth;
    });
    expect(focusOutline).not.toBe('0px');
  });
  
  test('screen reader announcements work correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/customer/session/sess_test');
    
    // Check for ARIA live regions
    const liveRegions = await page.locator('[aria-live]').count();
    expect(liveRegions).toBeGreaterThan(0);
    
    // Send message and verify announcement
    await page.fill('[data-testid="message-input"]', 'Test message');
    await page.click('[data-testid="send-button"]');
    
    // Check for aria-live announcement
    await expect(page.locator('[aria-live="polite"]')).toContainText('Message sent');
  });
});
```

### 7.2 Manual Accessibility Testing Checklist

```markdown
# Manual Accessibility Testing Checklist

## Screen Reader Testing

### NVDA (Windows)
- [ ] Navigate entire app with keyboard only
- [ ] All images have alt text
- [ ] Form labels read correctly
- [ ] Dynamic content announces changes
- [ ] Error messages announced
- [ ] Loading states announced

### VoiceOver (macOS/iOS)
- [ ] Rotor navigation works
- [ ] Gestures work on iPad kiosk
- [ ] All controls labeled
- [ ] Tables navigable
- [ ] Landmarks present and correct

## Keyboard Navigation
- [ ] Tab order logical
- [ ] All features accessible without mouse
- [ ] Focus indicators visible (3:1 contrast)
- [ ] No keyboard traps
- [ ] Skip links work
- [ ] Escape key closes modals

## Visual
- [ ] Color contrast 4.5:1 minimum (text)
- [ ] Color contrast 3:1 minimum (UI components)
- [ ] Text resizable to 200%
- [ ] No information by color alone
- [ ] Focus indicators 3:1 contrast

## Motor
- [ ] Touch targets >= 44px
- [ ] No time limits (or can be extended)
- [ ] Gesture alternatives available
- [ ] Voice input works

## Cognitive
- [ ] Clear language
- [ ] Consistent navigation
- [ ] Error recovery clear
- [ ] Instructions provided
- [ ] Confirmation for destructive actions
```

---

## 8. AI Model Evaluation

### 8.1 Fluency Shield Evaluation

```python
# tests/evaluation/fluency_shield_eval.py

class FluencyShieldEvaluator:
    """Evaluate Fluency Shield semantic preservation"""
    
    def __init__(self, test_set_path: str):
        self.test_cases = self.load_test_set(test_set_path)
    
    def load_test_set(self, path: str) -> List[TestCase]:
        """
        Load test set with:
        - original_speech (with disfluencies)
        - ground_truth_intent (human-annotated intended meaning)
        - critical_elements (must-preserve words/phrases)
        """
        pass
    
    async def evaluate(self) -> EvaluationReport:
        results = []
        
        for case in self.test_cases:
            # Run reconstruction
            result = await self.speech_service.reconstruct(
                case.original_speech,
                language=case.language
            )
            
            # Check semantic preservation
            semantic_match = self.check_semantic_match(
                result.reconstructed,
                case.ground_truth_intent
            )
            
            # Check critical elements preserved
            critical_preserved = all(
                elem.lower() in result.reconstructed.lower()
                for elem in case.critical_elements
            )
            
            # Check negation preserved
            negation_preserved = self.check_negation_preserved(
                case.original_speech,
                result.reconstructed
            )
            
            results.append({
                'case_id': case.id,
                'semantic_match': semantic_match,
                'critical_preserved': critical_preserved,
                'negation_preserved': negation_preserved,
                'wer': self.calculate_wer(result.reconstructed, case.ground_truth)
            })
        
        return self.generate_report(results)
    
    def generate_report(self, results) -> EvaluationReport:
        return EvaluationReport(
            total_cases=len(results),
            semantic_accuracy=sum(r['semantic_match'] for r in results) / len(results),
            critical_preservation=sum(r['critical_preserved'] for r in results) / len(results),
            negation_accuracy=sum(r['negation_preserved'] for r in results) / len(results),
            mean_wer=sum(r['wer'] for r in results) / len(results)
        )

# Run evaluation
evaluator = FluencyShieldEvaluator('tests/data/fluency_test_set.json')
report = await evaluator.evaluate()

# Assert thresholds
assert report.semantic_accuracy >= 0.95, "Semantic preservation below threshold"
assert report.critical_preservation >= 0.98, "Critical information loss detected"
assert report.negation_accuracy >= 0.95, "Negation handling below threshold"
```

### 8.2 Gesture Recognition Evaluation

```python
# tests/evaluation/gesture_eval.py

class GestureEvaluator:
    """Evaluate gesture recognition accuracy"""
    
    async def evaluate_precision_recall(self, test_videos: List[str]):
        """
        Test with:
        - Positive samples (correct gestures)
        - Negative samples (similar but different gestures)
        - Noise samples (random hand movements)
        """
        true_positives = 0
        false_positives = 0
        false_negatives = 0
        
        for video in test_videos:
            landmarks = await self.extract_landmarks(video)
            prediction = await self.gesture_service.match_gesture(
                user_id="test_user",
                landmarks=landmarks
            )
            
            ground_truth = video.metadata['gesture_id']
            
            if prediction.matched and prediction.gesture_id == ground_truth:
                true_positives += 1
            elif prediction.matched and prediction.gesture_id != ground_truth:
                false_positives += 1
            elif not prediction.matched and ground_truth is not None:
                false_negatives += 1
        
        precision = true_positives / (true_positives + false_positives)
        recall = true_positives / (true_positives + false_negatives)
        f1 = 2 * (precision * recall) / (precision + recall)
        
        return {
            'precision': precision,
            'recall': recall,
            'f1_score': f1
        }

# Target: Precision >= 0.85, Recall >= 0.80, F1 >= 0.82
```

### 8.3 Response Generation Evaluation

```python
# tests/evaluation/response_generation_eval.py

class ResponseGenerationEvaluator:
    """Evaluate contextual response quality"""
    
    async def evaluate_grounding(self, test_cases: List[TestCase]):
        """Ensure responses contain only grounded facts"""
        violations = []
        
        for case in test_cases:
            responses = await self.response_generator.generate_responses(
                context=case.business_context,
                conversation_history=case.history,
                latest_message=case.message
            )
            
            for response in responses:
                # Check each fact in response
                for fact in self.extract_facts(response.text):
                    if not self.is_grounded_in_context(fact, case.business_context):
                        violations.append({
                            'case_id': case.id,
                            'response': response.text,
                            'ungrounded_fact': fact
                        })
        
        # Zero tolerance for ungrounded facts
        assert len(violations) == 0, f"Found {len(violations)} ungrounded facts"
```

---

## 9. Security Testing

### 9.1 Authentication & Authorization Tests

```python
# tests/security/test_auth.py

class TestAuthSecurity:
    
    def test_expired_token_rejected(self):
        """Expired JWT should be rejected"""
        expired_token = create_expired_token()
        response = client.get(
            "/v1/sessions/sess_123",
            headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401
    
    def test_cannot_access_other_user_session(self):
        """Users cannot access sessions they don't belong to"""
        user_a_token = create_token(user_id="user_a")
        user_b_session = create_session(user_id="user_b")
        
        response = client.get(
            f"/v1/sessions/{user_b_session.session_id}",
            headers={"Authorization": f"Bearer {user_a_token}"}
        )
        assert response.status_code == 403
    
    def test_sql_injection_prevented(self):
        """SQL injection attempts should be sanitized"""
        malicious_input = "sess_123'; DROP TABLE sessions; --"
        response = client.get(f"/v1/sessions/{malicious_input}")
        assert response.status_code in [400, 404]
        
        # Verify sessions table still exists
        assert db.execute("SELECT 1 FROM sessions LIMIT 1").fetchone()
```

### 9.2 PII Protection Tests

```python
# tests/security/test_pii.py

def test_pii_redacted_in_logs(caplog):
    """PII should be redacted in application logs"""
    # Send message with PII
    client.post("/v1/sessions/sess_123/messages", json={
        "content": {
            "text": "My phone is 555-123-4567 and email is user@example.com"
        }
    })
    
    # Check logs don't contain PII
    for record in caplog.records:
        assert "555-123-4567" not in record.message
        assert "user@example.com" not in record.message
        assert "[REDACTED]" in record.message or "555" not in record.message
```

### 9.3 Penetration Testing Checklist

```markdown
# Security Testing Checklist

## OWASP Top 10

### A01: Broken Access Control
- [ ] Session hijacking prevented
- [ ] Horizontal privilege escalation prevented
- [ ] Vertical privilege escalation prevented
- [ ] IDOR vulnerabilities patched

### A02: Cryptographic Failures
- [ ] Sensitive data encrypted in transit (TLS 1.3)
- [ ] Sensitive data encrypted at rest
- [ ] No credentials in code/logs
- [ ] Secure key management

### A03: Injection
- [ ] SQL injection prevented (parameterized queries)
- [ ] NoSQL injection prevented
- [ ] Command injection prevented
- [ ] XSS prevented (CSP, sanitization)

### A04: Insecure Design
- [ ] Threat model documented
- [ ] Security requirements defined
- [ ] Rate limiting implemented
- [ ] Input validation comprehensive

### A05: Security Misconfiguration
- [ ] Default credentials changed
- [ ] Unnecessary features disabled
- [ ] Error messages don't leak info
- [ ] Security headers configured

### A06: Vulnerable Components
- [ ] Dependencies scanned (Snyk, Dependabot)
- [ ] No known vulnerabilities
- [ ] Dependencies up to date
- [ ] Supply chain security

### A07: Identification and Authentication Failures
- [ ] Multi-factor authentication (where applicable)
- [ ] Password policy enforced
- [ ] Session management secure
- [ ] Brute force protection

### A08: Software and Data Integrity Failures
- [ ] CI/CD pipeline secure
- [ ] Code signing implemented
- [ ] Integrity checks on updates
- [ ] No unsigned/untrusted sources

### A09: Security Logging and Monitoring Failures
- [ ] All auth events logged
- [ ] Failed access logged
- [ ] Alerting configured
- [ ] Audit trail tamper-proof

### A10: Server-Side Request Forgery
- [ ] URL validation
- [ ] Network segmentation
- [ ] Whitelist-based filtering
- [ ] No arbitrary URL fetching
```

---

## 10. Test Data Management

### 10.1 Test Data Strategy

```python
# tests/fixtures/test_data.py

@pytest.fixture(scope="session")
def test_database():
    """Create isolated test database"""
    # Create test DB
    test_db_url = "postgresql://test:test@localhost/interact_test"
    engine = create_engine(test_db_url)
    
    # Run migrations
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option("sqlalchemy.url", test_db_url)
    command.upgrade(alembic_cfg, "head")
    
    yield engine
    
    # Cleanup
    engine.dispose()

@pytest.fixture(autouse=True)
def clean_database(test_database):
    """Clean database between tests"""
    # Truncate all tables (except alembic_version)
    with test_database.connect() as conn:
        conn.execute("TRUNCATE sessions, participants, messages CASCADE")
        conn.commit()
```

### 10.2 Test Fixtures

```typescript
// tests/fixtures/audio-fixtures.ts

export const AudioFixtures = {
  // Clean speech sample
  cleanSpeech: '/tests/fixtures/audio/clean_speech.mp3',
  
  // Speech with disfluencies
  disfluent: {
    repetition: '/tests/fixtures/audio/repetition.mp3',
    filler: '/tests/fixtures/audio/filler_words.mp3',
    block: '/tests/fixtures/audio/speech_block.mp3',
  },
  
  // Different languages
  languages: {
    hindi: '/tests/fixtures/audio/hindi_speech.mp3',
    hinglish: '/tests/fixtures/audio/hinglish_speech.mp3',
  },
  
  // Edge cases
  edgeCases: {
    veryQuiet: '/tests/fixtures/audio/quiet.mp3',
    backgroundNoise: '/tests/fixtures/audio/noisy.mp3',
    multiSpeaker: '/tests/fixtures/audio/multi_speaker.mp3',
  }
};
```

---

## Appendix: Test Execution Commands

```bash
# Backend tests
pytest tests/unit -v                    # Unit tests
pytest tests/integration -v -m "not slow"  # Fast integration tests
pytest tests/integration -v             # All integration tests
pytest --cov=app --cov-report=html     # Coverage report

# Frontend tests
npm test                                # Unit tests (Vitest)
npm run test:watch                     # Watch mode
npm run test:coverage                  # Coverage report

# E2E tests
npx playwright test                    # Run all E2E tests
npx playwright test --headed           # With browser visible
npx playwright test --debug            # Debug mode

# Performance tests
k6 run tests/performance/load-test.js  # Load test
k6 run tests/performance/stress-test.js  # Stress test

# Accessibility tests
npm run test:a11y                      # Automated a11y tests
pa11y-ci                               # Pa11y CI scan

# Security tests
npm audit                              # Dependency vulnerabilities
snyk test                              # Snyk security scan
pytest tests/security -v               # Security test suite

# All tests (CI pipeline)
./scripts/run-all-tests.sh
```

---

**Document Status:** Ready for Implementation  
**Next Steps:** Set up CI/CD pipeline with test automation
