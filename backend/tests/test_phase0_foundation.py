import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.models.events import EventType

class TestPhase0Foundation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_health_check(self):
        """Verify root and v1 health endpoints"""
        res_root = self.client.get("/health")
        self.assertEqual(res_root.status_code, 200)
        self.assertEqual(res_root.json()["status"], "healthy")

        res_v1 = self.client.get("/api/v1/health")
        self.assertEqual(res_v1.status_code, 200)
        self.assertEqual(res_v1.json()["status"], "healthy")

    def test_02_session_lifecycle(self):
        """Verify session creation, lookup, joining, duplicate role prevention, and termination"""
        # 1. Create Session
        create_payload = {
            "organization_id": "org_demo",
            "business_context": {
                "type": "order",
                "id": "ZMT-1001",
                "data": {
                    "item": "Butter Chicken",
                    "amount": 450,
                    "status": "delivery_in_progress"
                }
            },
            "config": {"language": "en"}
        }
        res_create = self.client.post("/api/v1/sessions", json=create_payload)
        self.assertEqual(res_create.status_code, 201)
        data = res_create.json()
        session_id = data["session_id"]
        self.assertTrue(len(session_id) >= 6)
        self.assertEqual(data["status"], "active")
        self.assertIn("ws/sessions", data["websocket_url"])

        # 2. Get Session
        res_get = self.client.get(f"/api/v1/sessions/{session_id}")
        self.assertEqual(res_get.status_code, 200)
        session_data = res_get.json()
        self.assertEqual(session_data["session_id"], session_id)
        self.assertEqual(session_data["business_context"]["id"], "ZMT-1001")

        # 3. Customer Joins
        res_join_cust = self.client.post(
            f"/api/v1/sessions/{session_id}/join",
            json={"role": "customer", "participant_id": "cust_1"}
        )
        self.assertEqual(res_join_cust.status_code, 200)
        self.assertEqual(res_join_cust.json()["role"], "customer")

        # 4. Agent Joins
        res_join_agent = self.client.post(
            f"/api/v1/sessions/{session_id}/join",
            json={"role": "agent", "participant_id": "agent_1"}
        )
        self.assertEqual(res_join_agent.status_code, 200)
        self.assertEqual(res_join_agent.json()["role"], "agent")

        # 5. Duplicate Customer Rejection (HTTP 409 Conflict)
        res_dup_cust = self.client.post(
            f"/api/v1/sessions/{session_id}/join",
            json={"role": "customer", "participant_id": "cust_2"}
        )
        self.assertEqual(res_dup_cust.status_code, 409)

        # 6. End Session
        res_end = self.client.post(
            f"/api/v1/sessions/{session_id}/end",
            json={"ended_by": "agent_1", "reason": "resolved"}
        )
        self.assertEqual(res_end.status_code, 200)
        self.assertEqual(res_end.json()["status"], "ended")

        # 7. Joining Ended Session Rejected (HTTP 400 Bad Request)
        res_join_ended = self.client.post(
            f"/api/v1/sessions/{session_id}/join",
            json={"role": "customer", "participant_id": "cust_3"}
        )
        self.assertEqual(res_join_ended.status_code, 400)

    def test_03_websocket_event_routing(self):
        """Verify real-time bidirectional WebSocket message exchange and heartbeat"""
        # Create session
        res = self.client.post("/api/v1/sessions", json={})
        session_id = res.json()["session_id"]

        # Join customer and agent
        self.client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "customer", "participant_id": "c1"})
        self.client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "agent", "participant_id": "a1"})

        # Open WebSockets
        with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=c1") as ws_cust:
            with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=a1") as ws_agent:
                # Customer receives participant.joined notification for agent
                join_event = ws_cust.receive_json()
                self.assertEqual(join_event["event_type"], EventType.PARTICIPANT_JOINED.value)
                self.assertEqual(join_event["sender_id"], "a1")

                # Test 1: Ping / Pong Heartbeat
                ws_cust.send_json({"event_type": "ping", "event_id": "ping_123"})
                pong = ws_cust.receive_json()
                self.assertEqual(pong["event_type"], EventType.PONG.value)
                self.assertEqual(pong["payload"]["reply_to"], "ping_123")

                # Test 2: Customer sends message.created
                msg_payload = {
                    "event_type": EventType.MESSAGE_CREATED.value,
                    "payload": {
                        "message_id": "m1",
                        "source": "text",
                        "text": "Hello agent, my item is missing"
                    }
                }
                ws_cust.send_json(msg_payload)

                # Customer gets delivery ack
                ack = ws_cust.receive_json()
                self.assertEqual(ack["event_type"], EventType.MESSAGE_DELIVERED.value)
                self.assertEqual(ack["payload"]["message_id"], "m1")

                # Agent receives message.created
                agent_msg = ws_agent.receive_json()
                self.assertEqual(agent_msg["event_type"], EventType.MESSAGE_CREATED.value)
                self.assertEqual(agent_msg["sender_id"], "c1")
                self.assertEqual(agent_msg["payload"]["text"], "Hello agent, my item is missing")

                # Test 3: Customer sends participant.activity (reviewing)
                act_payload = {
                    "event_type": EventType.PARTICIPANT_ACTIVITY.value,
                    "payload": {"activity": "reviewing"}
                }
                ws_cust.send_json(act_payload)

                # Agent receives activity update
                agent_act = ws_agent.receive_json()
                self.assertEqual(agent_act["event_type"], EventType.PARTICIPANT_ACTIVITY.value)
                self.assertEqual(agent_act["payload"]["activity"], "reviewing")

if __name__ == "__main__":
    unittest.main()
