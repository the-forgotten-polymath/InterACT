import json
from fastapi.testclient import TestClient
from app.main import app

def run_live_e2e_test():
    print("\n=======================================================")
    print("🚀 InterACT END-TO-END VERIFICATION SUITE (PHASES 0 TO 3)")
    print("=======================================================\n")

    client = TestClient(app)

    # -----------------------------------------------------------------
    # STEP 1: Verify Health
    # -----------------------------------------------------------------
    print("[1/6] Testing Server Health...")
    res = client.get("/api/v1/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    data = res.json()
    print(f"  ✓ Service: {data['service']} | Status: {data['status']}")

    # -----------------------------------------------------------------
    # STEP 2: Phase 0 Foundation — Session Creation & Lifecycle
    # -----------------------------------------------------------------
    print("\n[2/6] Testing Phase 0: Session Creation & Room Code...")
    zomato_order = {
        "type": "order",
        "id": "ZMT-4092",
        "data": {
            "restaurant": "Punjab Grill Express",
            "items": "Paneer Tikka Butter Masala (x1), Garlic Naan (x2)",
            "total": "₹420.00",
            "eta": "12 mins ago (DELAYED)"
        }
    }
    res_create = client.post("/api/v1/sessions", json={"business_context": zomato_order})
    assert res_create.status_code == 201, f"Create session failed: {res_create.text}"
    session_info = res_create.json()
    session_id = session_info["session_id"]
    print(f"  ✓ Session Created: Room Code [{session_id}]")

    res_get = client.get(f"/api/v1/sessions/{session_id}")
    assert res_get.status_code == 200
    session_full = res_get.json()
    print(f"  ✓ Order Context Attached: #{session_full['business_context']['id']} ({session_full['business_context']['data']['restaurant']})")

    # Join customer and agent via REST
    res_c = client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "customer", "participant_id": "cust_live"})
    assert res_c.status_code == 200
    res_a = client.post(f"/api/v1/sessions/{session_id}/join", json={"role": "agent", "participant_id": "agent_live"})
    assert res_a.status_code == 200
    print(f"  ✓ Participants Registered: cust_live (Customer) & agent_live (Agent)")

    # -----------------------------------------------------------------
    # STEP 3: Phase 1 Core Communication — Real-Time WebSocket Routing
    # -----------------------------------------------------------------
    print("\n[3/6] Testing Phase 1: Real-Time Bidirectional WebSockets & Anti-Hangup...")
    ws_url_cust = f"/api/v1/ws/sessions/{session_id}?participant_id=cust_live"
    ws_url_agent = f"/api/v1/ws/sessions/{session_id}?participant_id=agent_live"

    with client.websocket_connect(ws_url_cust) as ws_cust:
        with client.websocket_connect(ws_url_agent) as ws_agent:
            # Customer receives agent join event
            evt_join = ws_cust.receive_json()
            assert evt_join["event_type"] == "participant.joined"
            print(f"  ✓ Customer received real-time agent presence notification: {evt_join['sender_id']} joined")

            # Customer sends typing activity
            ws_cust.send_json({
                "event_type": "participant.activity",
                "payload": {"activity": "typing"}
            })
            evt_act = ws_agent.receive_json()
            assert evt_act["payload"]["activity"] == "typing"
            print(f"  ✓ Agent received live anti-hangup typing signal: 'Customer is typing...'")

            # -----------------------------------------------------------------
            # STEP 4: Phase 2 Type-to-Voice Communication
            # -----------------------------------------------------------------
            print("\n[4/6] Testing Phase 2: Type-to-Voice Synthesis & Audio Routing...")
            
            # Test Speech Synthesis REST Endpoint
            tts_res = client.post("/api/v1/speech/synthesize", json={
                "text": "My food has arrived cold, please help arrange replacement.",
                "language": "en-IN"
            })
            assert tts_res.status_code == 200
            tts_data = tts_res.json()
            print(f"  ✓ TTS Synthesis Endpoint: {tts_data['duration_seconds']}s audio duration estimated for '{tts_data['text']}'")

            # Customer sends typed message over WebSocket with Type-to-Voice metadata
            msg_payload = {
                "message_id": "msg_live_100",
                "text": "My food has arrived cold, please help arrange replacement.",
                "message_type": "text",
                "sender_role": "customer",
                "metadata": {
                    "spoken_to_agent": True,
                    "speech_language": "en-IN",
                    "synthesize": True
                }
            }
            ws_cust.send_json({
                "event_type": "message.created",
                "payload": msg_payload
            })

            # Customer receives delivery confirmation ACK
            ack = ws_cust.receive_json()
            assert ack["event_type"] == "message.delivered"
            print(f"  ✓ Customer received delivery confirmation ACK (message_id: {ack['payload']['message_id']})")

            # Agent receives the customer message
            agent_msg = ws_agent.receive_json()
            assert agent_msg["event_type"] == "message.created"
            assert agent_msg["payload"]["metadata"]["spoken_to_agent"] is True
            print(f"  ✓ Agent received message with Type-to-Voice flag: '{agent_msg['payload']['text']}'")

            # Agent speaks back using voice-to-text
            agent_reply = {
                "message_id": "msg_agent_101",
                "text": "Hello, I can see order #ZMT-4092 is delayed. I will contact the restaurant immediately.",
                "message_type": "text",
                "sender_role": "agent",
                "metadata": {"agent_voice": True}
            }
            ws_agent.send_json({
                "event_type": "message.created",
                "payload": agent_reply
            })

            # Agent receives delivery ACK
            agent_ack = ws_agent.receive_json()
            assert agent_ack["event_type"] == "message.delivered"
            print(f"  ✓ Agent received delivery confirmation ACK (message_id: {agent_ack['payload']['message_id']})")

            # Customer receives agent response
            cust_received = ws_cust.receive_json()
            assert cust_received["payload"]["text"] == agent_reply["text"]
            print(f"  ✓ Customer received agent voice-transcribed reply: '{cust_received['payload']['text']}'")

            # -----------------------------------------------------------------
            # STEP 5: Phase 3 Fluency Shield / Speech Assistance
            # -----------------------------------------------------------------
            print("\n[5/6] Testing Phase 3: Fluency Shield Disfluency Cleaning & Approval Gate...")
            
            # Stuttered / dysarthric raw test cases
            stutter_sample = "um... uh... I... I... I did not receive ₹320 refund for my my order #ZMT-4092"
            block_sample = "p-p-paneer t-t-tikka is cold"

            # 1. Test Fluency Shield Reconstruct API
            reconstruct_res = client.post("/api/v1/fluency/reconstruct", json={
                "raw_transcript": stutter_sample,
                "language": "en"
            })
            assert reconstruct_res.status_code == 200
            rec_data = reconstruct_res.json()
            print(f"  • Raw Input: \"{rec_data['raw_transcript']}\"")
            print(f"  • Reconstructed Proposal: \"{rec_data['reconstructed_text']}\"")
            print(f"  • Disfluencies Cleaned: {rec_data['disfluencies_detected']}")
            print(f"  • Critical Entities Preserved: {rec_data['preserved_entities']}")
            assert "not" in rec_data["reconstructed_text"].lower(), "Negation MUST be preserved!"
            assert "#ZMT-4092" in rec_data["reconstructed_text"], "Order ID MUST be preserved!"
            assert "₹320" in rec_data["reconstructed_text"], "Currency amount MUST be preserved!"

            # Test syllable blocks
            block_res = client.post("/api/v1/fluency/reconstruct", json={
                "raw_transcript": block_sample,
                "language": "en"
            })
            assert block_res.status_code == 200
            block_data = block_res.json()
            print(f"  ✓ Syllable Blocks Test: \"{block_sample}\" → \"{block_data['reconstructed_text']}\"")

            # Customer enters 'reviewing' state
            ws_cust.send_json({
                "event_type": "participant.activity",
                "payload": {"activity": "reviewing"}
            })
            evt_rev = ws_agent.receive_json()
            assert evt_rev["payload"]["activity"] == "reviewing"
            print(f"  ✓ Agent informed of customer reviewing state: 'Customer is reviewing speech with Fluency Shield...'")

            # 2. Customer explicitly approves the reconstructed message
            approved_msg = {
                "message_id": "msg_fluency_approved_102",
                "raw_transcript": stutter_sample,
                "approved_text": rec_data["reconstructed_text"],
                "fluency_shield": True,
                "disfluencies_removed": rec_data["disfluencies_detected"],
                "preserved_entities": rec_data["preserved_entities"],
                "language": "en-IN"
            }
            ws_cust.send_json({
                "event_type": "speech.approved",
                "payload": approved_msg
            })

            # Agent receives approved speech message
            agent_approved = ws_agent.receive_json()
            assert agent_approved["event_type"] == "speech.approved"
            assert agent_approved["payload"]["approved_text"] == rec_data["reconstructed_text"]
            assert agent_approved["payload"]["raw_transcript"] == stutter_sample
            print(f"  ✓ Agent received customer-approved speech message:")
            print(f"      Clean Approved Text: \"{agent_approved['payload']['approved_text']}\"")
            print(f"      Preserved Raw Speech (for audit): \"{agent_approved['payload']['raw_transcript']}\"")

    # -----------------------------------------------------------------
    # STEP 6: Session Termination
    # -----------------------------------------------------------------
    print("\n[6/6] Testing Clean Session Termination...")
    res_end = client.post(f"/api/v1/sessions/{session_id}/end", json={
        "ended_by": "agent_live",
        "reason": "customer_issue_resolved"
    })
    assert res_end.status_code == 200
    print(f"  ✓ Session [{session_id}] concluded cleanly.")

    print("\n=======================================================")
    print("🎉 ALL PHASES (0, 1, 2, 3) VERIFIED WORKING 100%!")
    print("=======================================================\n")

if __name__ == "__main__":
    run_live_e2e_test()
