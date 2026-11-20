# InterACT — Development Workflow & Standards

**Version:** 1.0  
**Last Updated:** November 20, 2026

---

## Table of Contents
1. [Development Setup](#development-setup)
2. [Git Workflow](#git-workflow)
3. [Code Standards](#code-standards)
4. [Pull Request Process](#pull-request-process)
5. [CI/CD Pipeline](#cicd-pipeline)
6. [Environment Management](#environment-management)
7. [Deployment Process](#deployment-process)

---

## 1. Development Setup

### 1.1 Prerequisites

```bash
# Required
- Node.js 20+
- Python 3.11+
- PostgreSQL 15+
- Redis 7+
- Docker & Docker Compose
- Git

# Recommended
- VS Code with extensions:
  - Python
  - ESLint
  - Prettier
  - GitLens
  - Thunder Client (API testing)
```

### 1.2 Initial Setup

```bash
# Clone repository
git clone https://github.com/your-org/interact.git
cd interact

# Install backend dependencies
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Install frontend dependencies
cd ../frontend
npm install

# Install SDK dependencies
cd ../sdk
npm install

# Set up database
docker-compose up -d postgres redis

# Run migrations
cd ../backend
alembic upgrade head

# Seed test data
python scripts/seed_data.py

# Start development servers
# Terminal 1 - Backend
cd backend
uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - SDK build (watch mode)
cd sdk
npm run build:watch
```

### 1.3 Environment Variables

```bash
# backend/.env
DATABASE_URL=postgresql://interact:interact@localhost:5432/interact_dev
REDIS_URL=redis://localhost:6379/0
GEMINI_API_KEY=your_gemini_api_key_here
SECRET_KEY=your_secret_key_here
ENVIRONMENT=development
LOG_LEVEL=DEBUG

# frontend/.env
VITE_API_URL=http://localhost:8000/v1
VITE_WS_URL=ws://localhost:8000/v1/ws
VITE_ENVIRONMENT=development

# sdk/.env.test
INTERACT_API_URL=http://localhost:8000/v1
INTERACT_WS_URL=ws://localhost:8000/v1/ws
```

### 1.4 VS Code Configuration

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true,
  "python.linting.mypyEnabled": true,
  "python.formatting.provider": "black",
  "python.testing.pytestEnabled": true,
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[python]": {
    "editor.defaultFormatter": "ms-python.black-formatter"
  }
}
```

---

## 2. Git Workflow

### 2.1 Branch Strategy

```
main (protected)
├── develop (protected)
│   ├── feature/fluency-shield-reconstruction
│   ├── feature/gesture-enrollment
│   ├── bugfix/websocket-reconnection
│   └── hotfix/critical-auth-issue
└── release/v1.0.0
```

**Branch Naming:**
```bash
feature/{ticket-id}-brief-description
bugfix/{ticket-id}-brief-description
hotfix/{ticket-id}-brief-description
release/v{major}.{minor}.{patch}

# Examples
feature/INT-123-implement-fluency-shield
bugfix/INT-456-fix-message-delivery
hotfix/INT-789-auth-bypass-patch
```

### 2.2 Commit Messages

**Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding/updating tests
- `chore`: Build process, dependencies

**Examples:**
```bash
feat(fluency-shield): implement speech reconstruction

- Add disfluency detection algorithm
- Integrate Gemini API for reconstruction
- Add customer approval workflow

Closes INT-123

---

fix(websocket): handle reconnection with missed events

- Store last event ID on client
- Request event replay on reconnect
- Add exponential backoff

Fixes INT-456

---

perf(gesture): optimize landmark normalization

Reduces gesture matching latency from 150ms to 50ms

Related to INT-789
```

### 2.3 Git Commands Workflow

```bash
# Start new feature
git checkout develop
git pull origin develop
git checkout -b feature/INT-123-new-feature

# Make changes and commit
git add .
git commit -m "feat(component): add new feature"

# Keep branch up to date
git fetch origin
git rebase origin/develop

# Push to remote
git push origin feature/INT-123-new-feature

# Create pull request (via GitHub/GitLab UI)

# After PR merged, cleanup
git checkout develop
git pull origin develop
git branch -d feature/INT-123-new-feature
```

### 2.4 Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.5.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
      - id: check-added-large-files
        args: ['--maxkb=1000']
      - id: check-merge-conflict
  
  - repo: https://github.com/psf/black
    rev: 23.11.0
    hooks:
      - id: black
        language_version: python3.11
  
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v8.54.0
    hooks:
      - id: eslint
        files: \.(js|jsx|ts|tsx)$
        types: [file]
        args: ['--fix']
  
  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.1.0
    hooks:
      - id: prettier
        files: \.(js|jsx|ts|tsx|json|css|md)$

# Install hooks
pre-commit install
```

---

## 3. Code Standards

### 3.1 Python Code Standards

```python
# Style: Black formatter, PEP 8 compliant

# Good: Clear function names, type hints, docstrings
async def create_session(
    organization_id: str,
    business_context: BusinessContext,
    config: SessionConfig
) -> Session:
    """
    Create a new communication session.
    
    Args:
        organization_id: The organization creating the session
        business_context: Order, appointment, or account context
        config: Session configuration (language, features, timeout)
    
    Returns:
        Created session with session_id and WebSocket URL
    
    Raises:
        ValidationError: If business_context is invalid
        DatabaseError: If session creation fails
    """
    # Validate inputs
    if not business_context.type in ["order", "appointment", "account"]:
        raise ValidationError(f"Invalid context type: {business_context.type}")
    
    # Create session
    session = Session(
        session_id=f"sess_{uuid.uuid4().hex[:12]}",
        organization_id=organization_id,
        business_context=business_context,
        config=config,
        status=SessionStatus.ACTIVE,
        created_at=datetime.utcnow()
    )
    
    # Persist to database and cache
    await db.sessions.create(session)
    await redis.hset(f"session:{session.session_id}", mapping=session.dict())
    
    return session

# Bad: No types, no docstring, unclear names
async def create(o, c, cfg):
    s = Session()
    s.oid = o
    s.ctx = c
    await db.save(s)
    return s
```

**Python Patterns:**
```python
# Use Pydantic for validation
from pydantic import BaseModel, validator

class BusinessContext(BaseModel):
    type: str
    id: str
    data: dict
    
    @validator('type')
    def validate_type(cls, v):
        if v not in ['order', 'appointment', 'account']:
            raise ValueError('Invalid context type')
        return v

# Use async/await consistently
async def process_transcription(audio: bytes) -> str:
    # Not: return transcribe(audio)  # Blocking!
    return await transcribe_async(audio)

# Handle errors explicitly
try:
    result = await gemini_api.transcribe(audio)
except GeminiAPIError as e:
    logger.error(f"Transcription failed: {e}")
    # Fallback or re-raise
    raise TranscriptionError("Failed to transcribe audio") from e

# Use dependency injection
class SessionManager:
    def __init__(self, db: Database, redis: Redis, event_router: EventRouter):
        self.db = db
        self.redis = redis
        self.event_router = event_router
```

### 3.2 TypeScript/React Code Standards

```typescript
// Style: Prettier, ESLint with Airbnb config

// Good: Clear interfaces, proper types, documented
interface Message {
  messageId: string;
  senderId: string;
  senderRole: 'customer' | 'agent';
  source: MessageSource;
  content: MessageContent;
  createdAt: string;
}

interface MessageContent {
  text: string;
  language: string;
  audioUrl?: string;
}

/**
 * Display a chat message with sender info and timestamp
 */
export const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  const { text, audioUrl } = message.content;
  const isCustomer = message.senderRole === 'customer';
  
  return (
    <div
      className={cn(
        'message-bubble',
        isCustomer ? 'message-customer' : 'message-agent'
      )}
      data-testid="message-bubble"
      role="article"
      aria-label={`Message from ${message.senderRole}`}
    >
      <p className="message-text">{text}</p>
      {audioUrl && <AudioPlayer src={audioUrl} />}
      <time className="message-timestamp" dateTime={message.createdAt}>
        {formatTimestamp(message.createdAt)}
      </time>
    </div>
  );
};

// Bad: Any types, no accessibility, unclear
export const Msg = ({ data }: { data: any }) => {
  return (
    <div className={data.role}>
      <p>{data.txt}</p>
    </div>
  );
};
```

**TypeScript Patterns:**
```typescript
// Use discriminated unions for polymorphic data
type Event =
  | { type: 'message.received'; payload: Message }
  | { type: 'participant.joined'; payload: Participant }
  | { type: 'session.ended'; payload: { reason: string } };

function handleEvent(event: Event) {
  switch (event.type) {
    case 'message.received':
      // TypeScript knows payload is Message
      console.log(event.payload.content.text);
      break;
    case 'participant.joined':
      // TypeScript knows payload is Participant
      console.log(event.payload.role);
      break;
  }
}

// Use custom hooks for shared logic
function useWebSocket(url: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<Event | null>(null);
  const ws = useRef<WebSocket | null>(null);
  
  useEffect(() => {
    ws.current = new WebSocket(url);
    
    ws.current.onopen = () => setIsConnected(true);
    ws.current.onmessage = (e) => setLastMessage(JSON.parse(e.data));
    ws.current.onclose = () => setIsConnected(false);
    
    return () => ws.current?.close();
  }, [url]);
  
  return { isConnected, lastMessage, send: (data) => ws.current?.send(JSON.stringify(data)) };
}

// Use React Query for server state
const { data: session, isLoading } = useQuery({
  queryKey: ['session', sessionId],
  queryFn: () => api.getSession(sessionId),
  refetchInterval: 30000, // Refresh every 30 seconds
});
```

### 3.3 Code Review Checklist

```markdown
## Functionality
- [ ] Code does what it's supposed to do
- [ ] Edge cases handled
- [ ] Error handling appropriate
- [ ] No obvious bugs

## Code Quality
- [ ] Clear, self-documenting code
- [ ] Functions are single-purpose
- [ ] No code duplication
- [ ] Magic numbers extracted to constants
- [ ] Complex logic has comments

## Types & Validation
- [ ] Type annotations present (Python/TypeScript)
- [ ] Input validation present
- [ ] API responses validated

## Testing
- [ ] Unit tests added/updated
- [ ] Tests cover new functionality
- [ ] Tests are deterministic
- [ ] Edge cases tested

## Security
- [ ] No credentials in code
- [ ] SQL injection prevented
- [ ] XSS prevented
- [ ] Authorization checked
- [ ] PII handled correctly

## Performance
- [ ] No obvious performance issues
- [ ] Database queries optimized
- [ ] API calls minimized
- [ ] Large files/data handled efficiently

## Accessibility (Frontend)
- [ ] Semantic HTML used
- [ ] ARIA labels present
- [ ] Keyboard navigation works
- [ ] Focus management correct
- [ ] Color contrast sufficient

## Documentation
- [ ] Docstrings/JSDoc present
- [ ] README updated if needed
- [ ] API docs updated if needed
- [ ] Complex logic explained
```

---

## 4. Pull Request Process

### 4.1 PR Template

```markdown
## Description
Brief description of what this PR does.

## Related Issue
Closes #123
Related to #456

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement

## Changes Made
- Added fluency shield reconstruction service
- Integrated Gemini API for speech processing
- Added customer approval workflow UI

## Testing Done
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] E2E tests added/updated
- [ ] Manual testing completed
- [ ] Tested on multiple devices/browsers

## Screenshots (if applicable)
[Add screenshots here]

## Performance Impact
- Latency: p95 < 2s (target: < 3s) ✓
- Memory: No significant increase
- Database: Added 1 index on messages table

## Security Considerations
- [ ] No PII logged
- [ ] Input validation added
- [ ] Authorization checks present
- [ ] No credentials in code

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass locally
- [ ] Dependent changes merged

## Deployment Notes
None / Requires database migration / Requires environment variable

## Reviewer Notes
Please pay special attention to the semantic preservation logic in `reconstruct_speech()`.
```

### 4.2 Review Process

```
1. Developer creates PR
   ├─ CI checks run automatically
   ├─ Request review from 2 team members
   └─ Add appropriate labels

2. Automated Checks
   ├─ Linting passes
   ├─ Type checking passes
   ├─ Unit tests pass
   ├─ Integration tests pass
   ├─ Test coverage >= 80%
   └─ Security scan passes

3. Code Review
   ├─ First reviewer (peer)
   ├─ Second reviewer (senior/lead)
   └─ All comments addressed

4. Approval & Merge
   ├─ All checks green
   ├─ 2 approvals received
   ├─ Conflicts resolved
   ├─ Squash and merge (or rebase)
   └─ Delete branch
```

### 4.3 Review Response Time SLA

```yaml
Priority Levels:
  Critical (P0):
    Description: Production issues, security vulnerabilities
    Response Time: 2 hours
    Review Time: 4 hours
  
  High (P1):
    Description: Important features, blocking bugs
    Response Time: 4 hours
    Review Time: 24 hours
  
  Normal (P2):
    Description: Regular features, non-blocking bugs
    Response Time: 24 hours
    Review Time: 48 hours
  
  Low (P3):
    Description: Refactoring, documentation
    Response Time: 48 hours
    Review Time: 1 week
```

---

## 5. CI/CD Pipeline

### 5.1 GitHub Actions Workflow

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [develop, main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install pylint mypy black
          pip install -r backend/requirements.txt
      
      - name: Run Python linters
        run: |
          black --check backend/
          pylint backend/app
          mypy backend/app
      
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install Node dependencies
        run: |
          cd frontend && npm ci
          cd ../sdk && npm ci
      
      - name: Run JS/TS linters
        run: |
          cd frontend && npm run lint
          cd ../sdk && npm run lint

  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: interact_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      
      - name: Install dependencies
        run: |
          pip install -r backend/requirements.txt
          pip install -r backend/requirements-dev.txt
      
      - name: Run migrations
        run: |
          cd backend
          alembic upgrade head
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/interact_test
      
      - name: Run tests
        run: |
          cd backend
          pytest tests/ -v --cov=app --cov-report=xml
        env:
          DATABASE_URL: postgresql://postgres:test@localhost:5432/interact_test
          REDIS_URL: redis://localhost:6379/0
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage.xml

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: cd frontend && npm ci
      
      - name: Run tests
        run: cd frontend && npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          file: ./frontend/coverage/coverage-final.json

  test-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Set up services
        run: docker-compose up -d
      
      - name: Install Playwright
        run: cd frontend && npx playwright install --with-deps
      
      - name: Run E2E tests
        run: cd frontend && npx playwright test
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: frontend/playwright-report/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Snyk scan
        uses: snyk/actions/python@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  build:
    needs: [lint, test-backend, test-frontend, test-e2e, security-scan]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build Docker images
        run: |
          docker build -t interact-backend:${{ github.sha }} backend/
          docker build -t interact-frontend:${{ github.sha }} frontend/
      
      - name: Push to registry
        if: github.ref == 'refs/heads/main'
        run: |
          echo ${{ secrets.DOCKER_PASSWORD }} | docker login -u ${{ secrets.DOCKER_USERNAME }} --password-stdin
          docker push interact-backend:${{ github.sha }}
          docker push interact-frontend:${{ github.sha }}
```

### 5.2 Deployment Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  deploy-staging:
    if: github.event_name == 'push' || github.event.inputs.environment == 'staging'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy to staging
        run: |
          # Deploy logic here
          kubectl set image deployment/interact-backend \
            interact-backend=interact-backend:${{ github.sha }} \
            -n staging
      
      - name: Run smoke tests
        run: |
          curl -f https://staging.interact.example.com/health || exit 1

  deploy-production:
    if: github.event.inputs.environment == 'production'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      
      - name: Create release
        uses: actions/create-release@v1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: v${{ github.run_number }}
          release_name: Release v${{ github.run_number }}
      
      - name: Deploy to production
        run: |
          # Blue-green deployment
          kubectl set image deployment/interact-backend \
            interact-backend=interact-backend:${{ github.sha }} \
            -n production
      
      - name: Run smoke tests
        run: |
          curl -f https://api.interact.example.com/health || exit 1
      
      - name: Notify team
        uses: 8398a7/action-slack@v3
        with:
          status: ${{ job.status }}
          text: 'Production deployment completed'
          webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 6. Environment Management

### 6.1 Environment Configuration

```yaml
Development:
  Purpose: Local development
  Data: Synthetic test data
  Services: Local Docker containers
  API Keys: Development keys
  Debugging: Enabled
  Logging: DEBUG level

Staging:
  Purpose: Pre-production testing
  Data: Anonymized production data
  Services: Kubernetes cluster (staging)
  API Keys: Staging keys
  Debugging: Limited
  Logging: INFO level
  
Production:
  Purpose: Live user traffic
  Data: Real user data
  Services: Kubernetes cluster (production)
  API Keys: Production keys
  Debugging: Disabled
  Logging: WARNING level
  Monitoring: Full observability stack
```

### 6.2 Secret Management

```bash
# Use environment-specific secrets

# Development: .env files (gitignored)
# Staging/Production: AWS Secrets Manager / HashiCorp Vault

# Example: Retrieve secret in CI
- name: Get secrets
  uses: aws-actions/aws-secretsmanager-get-secrets@v1
  with:
    secret-ids: |
      prod/interact/gemini-api-key
      prod/interact/database-password
    parse-json-secrets: true
```

---

## 7. Deployment Process

### 7.1 Deployment Checklist

```markdown
## Pre-Deployment
- [ ] All tests passing in CI
- [ ] Code review approved
- [ ] Database migrations prepared
- [ ] Environment variables configured
- [ ] Rollback plan documented
- [ ] Stakeholders notified

## Deployment
- [ ] Database migrations run
- [ ] Application deployed
- [ ] Health checks passing
- [ ] Smoke tests passing

## Post-Deployment
- [ ] Monitor error rates
- [ ] Monitor performance metrics
- [ ] Verify new features working
- [ ] Check logs for errors
- [ ] Notify team of completion

## Rollback (if needed)
- [ ] Identify issue
- [ ] Execute rollback script
- [ ] Verify rollback successful
- [ ] Document incident
- [ ] Plan fix
```

### 7.2 Rollback Procedure

```bash
# Rollback script
#!/bin/bash

PREVIOUS_VERSION=$1

echo "Rolling back to version $PREVIOUS_VERSION"

# Scale down new version
kubectl scale deployment interact-backend --replicas=0 -n production

# Scale up previous version
kubectl set image deployment/interact-backend-blue \
  interact-backend=interact-backend:$PREVIOUS_VERSION \
  -n production

# Wait for rollout
kubectl rollout status deployment/interact-backend-blue -n production

# Verify health
curl -f https://api.interact.example.com/health || exit 1

echo "Rollback complete"
```

---

**Document Status:** Ready for Use  
**Next Steps:** Share with development team and get feedback
