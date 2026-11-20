import unittest
from fastapi.testclient import TestClient
from app.main import app
from app.models.events import EventType

class TestPhase1Communication(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)

    def test_01_full_customer_agent_communication_flow(self):
        """Verify complete Phase 1 bidirectional customer-agent communication flow"""
        # 1. Customer initiates support session with Zomato order context
        order_context = {
            "type": "order",
            "id": "ZMT-4092",
            "data": {
                "item": "Paneer Tikka Butter Masala",
                "restaurant": "Punjab Grill",
                "amount": "₹320"
            }
        }
        res_create = self.client.post("/api/v1/sessions", json={"business_context": order_context})
        self.assertEqual(res_create.status_code, 201)
        session_id = res_create.json()["session_id"]

        # 2. Customer joins session
        res_join_c = self.client.post(
            f"/api/v1/sessions/{session_id}/join",
            json={"role": "customer", "participant_id": "cust_100"}
        )
        self.assertEqual(res_join_c.status_code, 200)

        # 3. Agent joins session
        res_join_a = self.client.post(
            f"/api/v1/sessions/{session_id}/join",
            json={"role": "agent", "participant_id": "agent_200"}
        )
        self.assertEqual(res_join_a.status_code, 200)

        # 4. Open real-time WebSocket channels
        with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=cust_100") as ws_cust:
            with self.client.websocket_connect(f"/api/v1/ws/sessions/{session_id}?participant_id=agent_200") as ws_agent:
                # Customer sees Agent joined
                evt_join = ws_cust.receive_json()
                self.assertEqual(evt_join["event_type"], EventType.PARTICIPANT_JOINED.value)
                self.assertEqual(evt_join["sender_id"], "agent_200")
                self.assertEqual(evt_join["sender_role"], "agent")

                # Customer broadcasts typing activity
                ws_cust.send_json({
                    "event_type": EventType.PARTICIPANT_ACTIVITY.value,
                    "payload": {"activity": "typing"}
                })
                # Agent receives activity update
                evt_act = ws_agent.receive_json()
                self.assertEqual(evt_act["event_type"], EventType.PARTICIPANT_ACTIVITY.value)
                self.assertEqual(evt_act["payload"]["activity"], "typing")

                # Customer sends message
                msg_payload = {
                    "event_type": EventType.MESSAGE_CREATED.value,
                    "payload": {
                        "message_id": "msg_001",
                        "source": "text",
                        "text": "My food was delivered without the naan."
                    }
                }
                ws_cust.send_json(msg_payload)

                # Customer receives delivery ACK
                ack = ws_cust.receive_json()
                self.assertEqual(ack["event_type"], EventType.MESSAGE_DELIVERED.value)
                self.assertEqual(ack["payload"]["message_id"], "msg_001")

                # Agent receives customer message
                agent_rcv = ws_agent.receive_json()
                self.assertEqual(agent_rcv["event_type"], EventType.MESSAGE_CREATED.value)
                self.assertEqual(agent_rcv["sender_id"], "cust_100")
                self.assertEqual(agent_rcv["payload"]["text"], "My food was delivered without the naan.")

                # Agent replies to customer
                reply_payload = {
                    "event_type": EventType.MESSAGE_CREATED.value,
                    "payload": {
                        "message_id": "msg_002",
                        "source": "text",
                        "text": "I am so sorry about that! I am processing a refund for the missing naan right away."
                    }
                }
                ws_agent.send_json(reply_payload)

                # Agent receives delivery ACK
                agent_ack = ws_agent.receive_json()
                self.assertEqual(agent_ack["event_type"], EventType.MESSAGE_DELIVERED.value)
                self.assertEqual(agent_ack["payload"]["message_id"], "msg_002")

                # Customer receives agent reply
                cust_rcv = ws_cust.receive_json()
                self.assertEqual(cust_rcv["event_type"], EventType.MESSAGE_CREATED.value)
                self.assertEqual(cust_rcv["sender_id"], "agent_200")
                self.assertEqual(cust_rcv["payload"]["text"], "I am so sorry about that! I am processing a refund for the missing naan right away.")

        # 5. Agent ends session
        res_end = self.client.post(
            f"/api/v1/sessions/{session_id}/end",
            json={"ended_by": "agent_200", "reason": "issue_resolved_refund"}
        )
        self.assertEqual(res_end.status_code, 200)
        self.assertEqual(res_end.json()["status"], "ended")

if __name__ == "__main__":
    unittest.main()
