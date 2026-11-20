import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.models.events import EventType

class TestPhase3Fluency(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_reconstruct_repetitions_and_fillers(self):
        """Verify repetitions and fillers are removed cleanly"""
        payload = {
            "raw_transcript": "um... uh... I... I... I need help with my my order"
        }
        res = self.client.post("/api/v1/fluency/reconstruct", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["reconstructed_text"], "I need help with my order.")
        self.assertIn("filler: um", data["disfluencies_detected"])
        self.assertIn("filler: uh", data["disfluencies_detected"])
        self.assertIn("repetition: I", data["disfluencies_detected"])
        self.assertIn("repetition: my", data["disfluencies_detected"])

    def test_02_reconstruct_preserves_critical_negation_and_entities(self):
        """Verify strict preservation of negation (not, never, don't) and order/currency IDs"""
        payload = {
            "raw_transcript": "uh I did not receive ₹320 refund for order #ZMT-4092"
        }
        res = self.client.post("/api/v1/fluency/reconstruct", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("not", data["reconstructed_text"].lower())
        self.assertIn("#zmt-4092", data["reconstructed_text"].lower())
        self.assertIn("₹320", data["reconstructed_text"])
        self.assertTrue(any("negation: not" in e for e in data["preserved_entities"]))

    def test_03_reconstruct_syllable_blocks(self):
        """Verify speech motor blocks (e.g. p-p-paneer) are resolved"""
        payload = {
            "raw_transcript": "p-p-paneer was d-d-delayed"
        }
        res = self.client.post("/api/v1/fluency/reconstruct", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["reconstructed_text"], "Paneer was delayed.")
        self.assertTrue(any("block: p-p-paneer" in d for d in data["disfluencies_detected"]))

    def test_04_reconstruct_ambiguous_single_filler(self):
        """Verify ambiguous single filler triggers clarification request"""
        payload = {
            "raw_transcript": "um"
        }
        res = self.client.post("/api/v1/fluency/reconstruct", json=payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertTrue(data["needs_clarification"])
        self.assertIsNotNone(data["clarification_prompt"])

    def test_05_fluency_shield_approval_websocket_flow(self):
        """Verify explicit customer approval gate over WebSocket before dispatch to agent"""
        res_create = self.client.post("/api/v1/sessions", json={})
        session_id = res_create.json()["session_id"]

        self.client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "customer", "participant_id": "cust_fluency"})
        self.client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "agent", "participant_id": "agent_fluency"})

        with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=cust_fluency") as ws_cust:
            with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=agent_fluency") as ws_agent:
                # Discard join event
                _ = ws_cust.receive_json()

                # Customer broadcasts 'reviewing' state to inform agent of pending speech review
                ws_cust.send_json({
                    "event_type": EventType.PARTICIPANT_ACTIVITY.value,
                    "payload": {"activity": "reviewing"}
                })
                evt_act = ws_agent.receive_json()
                self.assertEqual(evt_act["payload"]["activity"], "reviewing")

                # Once customer explicitly clicks "Approve", the approved message is dispatched
                approved_payload = {
                    "raw_transcript": "uh I I need replacement",
                    "approved_text": "I need replacement.",
                    "fluency_shield": True,
                    "disfluencies_removed": ["filler: uh", "repetition: I"]
                }
                ws_cust.send_json({
                    "event_type": EventType.SPEECH_APPROVED.value,
                    "payload": approved_payload
                })

                # Agent receives the customer-approved speech message
                evt_approved = ws_agent.receive_json()
                self.assertEqual(evt_approved["event_type"], EventType.SPEECH_APPROVED.value)
                self.assertEqual(evt_approved["payload"]["approved_text"], "I need replacement.")
                self.assertTrue(evt_approved["payload"]["fluency_shield"])
