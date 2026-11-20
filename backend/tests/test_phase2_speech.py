import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.models.events import EventType

class TestPhase2Speech(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_speech_synthesize_success(self):
        """Verify POST /api/v1/speech/synthesize produces speech configuration and duration"""
        payload = {
            "text": "Hello, I am asking about order #ZMT-4092 delivery delay.",
            "language": "en-US",
            "voice": "en-US-Neural2-C",
            "speed": 1.0
        }
        res = self.client.post("/api/v1/speech/synthesize", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["status"], "synthesized")
        self.assertEqual(data["language"], "en-US")
        self.assertEqual(data["text"], payload["text"])
        self.assertGreater(data["duration_seconds"], 0)
        self.assertEqual(data["audio_format"], "browser_speech_synthesis")
        self.assertEqual(data["metadata"]["word_count"], 9)

    def test_02_speech_synthesize_empty_text_validation(self):
        """Verify empty or blank text returns HTTP 400"""
        res = self.client.post("/api/v1/speech/synthesize", json={"text": "   "})
        self.assertEqual(res.status_code, 400)
        self.assertIn("cannot be empty", res.json()["detail"])

    def test_03_speech_transcribe_endpoint(self):
        """Verify POST /api/v1/speech/transcribe returns valid transcription format"""
        payload = {
            "language": "hi-IN",
            "audio_base64": "UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA="
        }
        res = self.client.post("/api/v1/speech/transcribe", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("transcript", data)
        self.assertGreaterEqual(data["confidence"], 0.9)
        self.assertEqual(data["language"], "hi-IN")

    def test_04_type_to_voice_websocket_event_flow(self):
        """Verify message payload carrying TTS voice attributes over real-time WebSocket"""
        res_create = self.client.post("/api/v1/sessions", json={})
        self.assertEqual(res_create.status_code, 201)
        session_id = res_create.json()["session_id"]

        self.client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "customer", "participant_id": "cust_t2v"})
        self.client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "agent", "participant_id": "agent_t2v"})

        with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=cust_t2v") as ws_cust:
            with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=agent_t2v") as ws_agent:
                # Discard join event
                _ = ws_cust.receive_json()

                # Customer sends typed message intended for voice playback on Agent side
                msg_payload = {
                    "text": "My food has arrived cold, please help arrange replacement.",
                    "message_type": "text",
                    "metadata": {
                        "spoken_to_agent": True,
                        "preferred_language": "en-US",
                        "synthesize": True
                    }
                }
                ws_cust.send_json({
                    "event_type": EventType.MESSAGE_CREATED.value,
                    "payload": msg_payload
                })

                # Agent receives message with TTS metadata
                evt_received = ws_agent.receive_json()
                self.assertEqual(evt_received["event_type"], EventType.MESSAGE_CREATED.value)
                self.assertEqual(evt_received["payload"]["text"], msg_payload["text"])
                self.assertTrue(evt_received["payload"]["metadata"]["spoken_to_agent"])
