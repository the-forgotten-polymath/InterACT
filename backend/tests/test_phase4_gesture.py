import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.models.events import EventType, ActivityType

class TestPhase4Gesture(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_gesture_activity_and_confirmation_broadcast(self):
        """Verify real-time gesture activity and confirmed macro broadcast from customer to agent"""
        # 1. Create support session
        res_create = self.client.post("/api/v1/sessions", json={
            "business_context": {
                "type": "order",
                "id": "ZMT-4092",
                "data": {"restaurant": "Punjab Grill", "item": "Paneer Tikka"}
            }
        })
        self.assertEqual(res_create.status_code, 201)
        session_id = res_create.json()["session_id"]

        # 2. Join participants
        self.client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "customer", "participant_id": "cust_gest"})
        self.client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "agent", "participant_id": "agent_gest"})

        # 3. Connect via WebSockets
        with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=cust_gest") as ws_cust:
            with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=agent_gest") as ws_agent:
                # Customer receives agent join event
                evt_join = ws_cust.receive_json()
                self.assertEqual(evt_join["event_type"], EventType.PARTICIPANT_JOINED.value)

                # Customer triggers gesture hold state (processing_gesture)
                ws_cust.send_json({
                    "event_type": EventType.PARTICIPANT_ACTIVITY.value,
                    "payload": {
                        "activity": ActivityType.PROCESSING_GESTURE.value,
                        "metadata": {"gesture_preview": "Thumbs Up"}
                    }
                })

                # Agent receives gesturing activity
                evt_act = ws_agent.receive_json()
                self.assertEqual(evt_act["event_type"], EventType.PARTICIPANT_ACTIVITY.value)
                self.assertEqual(evt_act["payload"]["activity"], ActivityType.PROCESSING_GESTURE.value)

                # Customer holds gesture for 1.2s and confirms macro
                gesture_payload = {
                    "message_id": "msg_gesture_test123",
                    "gesture_id": "thumbs_up",
                    "gesture_name": "Thumbs Up",
                    "emoji": "👍",
                    "phrase": "Yes, I confirm."
                }
                ws_cust.send_json({
                    "event_type": EventType.GESTURE_CONFIRMED.value,
                    "payload": gesture_payload
                })

                # Agent receives gesture.confirmed event with all metadata
                evt_gesture = ws_agent.receive_json()
                self.assertEqual(evt_gesture["event_type"], EventType.GESTURE_CONFIRMED.value)
                self.assertEqual(evt_gesture["payload"]["gesture_name"], "Thumbs Up")
                self.assertEqual(evt_gesture["payload"]["emoji"], "👍")
                self.assertEqual(evt_gesture["payload"]["phrase"], "Yes, I confirm.")
                self.assertEqual(evt_gesture["sender_role"], "customer")

if __name__ == "__main__":
    unittest.main()
