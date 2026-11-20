# InterACT — Multimodal Accessibility Communication Platform

[![Accessibility: WCAG 2.1 AA](https://img.shields.io/badge/Accessibility-WCAG%202.1%20AA-blue.svg)](https://www.w3.org/WAI/standards-guidelines/wcag/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

> Bridging non-verbal and speech-divergent customers with human phone agents in real-time through Type-to-Voice, Fluency Shield neural cleaning, and WebRTC audio calling.

---

## 🌟 Key Features

1. **⚡ Type-to-Voice (Mithi v2 Flash & Web Speech):**
   - Non-verbal customers type responses that are synthesized into natural Indian voices (`ahana`, `charvi`, `satvik`, etc.) across English, Hindi, Bengali, Tamil, Telugu, and more.
   - Low latency audio delivery streamed directly to the agent's speaker.

2. **🛡️ Fluency Shield (Speech Assistance):**
   - **Disfluency-Aware Cleaner:** Automatically removes conversational fillers (`um`, `uh`, `matlab`) and syllable stutter blocks (`p-p-paneer` → `Paneer`).
   - **Semantic Preservation:** 100% strict preservation of negations (`not`, `no`), numbers, currency amounts (`₹320`), and order IDs (`#ZMT-4092`).
   - **Strict Customer Approval Gate:** Customer reviews side-by-side transcripts and explicitly approves before any speech is transmitted to the agent.

3. **📞 Real-Time WebRTC Voice Calling:**
   - Peer-to-peer live microphone streaming with STUN relay.
   - User-gesture incoming call gating (`📞 Incoming Voice Call... [Answer Call] [Decline]`) compatible with Safari, Chrome, and iOS/Android mobile browsers.

4. **🚀 1-Click Connected Split Test Mode:**
   - Test both Customer Portal and Agent Console side-by-side on desktop or on two separate devices.

---

## 🏗️ Architecture

```
InterACT/
├── frontend/               # React 19 + TypeScript + Vite + WebRTC Client
│   ├── src/
│   │   ├── components/     # CustomerView, AgentDashboard, FluencyShieldModal
│   │   ├── services/       # WebRTC, WebSocket, Speech, REST API
│   │   └── types/          # Typed Event & Session Contracts
├── backend/                # FastAPI + Uvicorn + WebSockets + PyTorch
│   ├── app/
│   │   ├── api/v1/         # REST & WebSocket endpoints
│   │   ├── models/         # Pydantic Event & Session schemas
│   │   └── services/       # RoomManager, SessionManager, MithiTTS, FluencyShield
└── CheckIn-1/              # Blueprint documentation & PRDs
```

---

## 🚀 Quick Start (Local Development)

### 1. Start the Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start the Frontend
```bash
cd frontend
npm install
npm run dev -- --host 0.0.0.0 --port 3000
```

Open `http://localhost:3000` on your desktop or `http://<your-lan-ip>:3000` on your mobile phone!

---

## ☁️ Deployment

### 1. Deploy Frontend to Vercel
1. Import repository `the-forgotten-polymath/InterACT` into Vercel.
2. If prompted for **Root Directory**, you can leave it at root `.` (managed via root `vercel.json`) or select `frontend`.
3. Set Environment Variables:
   - `VITE_API_URL`: Your backend API URL (e.g. `https://your-backend.run.app/api/v1`)
   - `VITE_WS_URL`: Your backend WebSocket URL (e.g. `wss://your-backend.run.app/api/v1/ws`)
4. Click **Deploy**.

### 2. Deploy Backend (Cloud Run / Render / Railway)
- **Dockerfile** is included in `backend/` for 1-click container deployment to Google Cloud Run or Railway.
- Exposes port `8000` with WebSocket support enabled.

---

## 🧪 Testing Across Two Devices
1. Open the Customer Portal on **Device A** (e.g., your laptop).
2. Open the Agent Console on **Device B** (e.g., your mobile phone).
3. Enter the same 6-letter Room Code to connect.
4. Test live typing, TTS voice playback, Fluency Shield stutter cleaning, and real-time WebRTC audio calling!
