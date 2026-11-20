from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
import logging
from ....models.events import Event, EventType
from ....models.session import ParticipantRole, ConnectionStatus
from ....services.session_manager import session_manager
from ....services.room_manager import room_manager

logger = logging.getLogger("interact.ws")
router = APIRouter()

@router.websocket("/sessions/{session_id}")
async def session_websocket(
    websocket: WebSocket,
    session_id: str,
    participant_id: str = Query(...)
):
    clean_id = session_id.strip().upper()
    session = session_manager.get_session(clean_id)

    if not session:
        await websocket.close(code=4004, reason="Session not found")
        return

    # Check participant
    participant = session.participants.get(participant_id)
    if not participant:
        await websocket.close(code=4003, reason="Participant not authorized in this session")
        return

    # Accept & register connection
    await room_manager.connect(clean_id, participant_id, websocket)
    participant.connection_status = ConnectionStatus.CONNECTED

    # Notify others that this participant has joined
    await room_manager.broadcast_to_room(
        session_id=clean_id,
        event=Event(
            event_type=EventType.PARTICIPANT_JOINED,
            session_id=clean_id,
            sender_id=participant_id,
            sender_role=participant.role,
            payload={
                "participant_id": participant_id,
                "role": participant.role.value,
                "connected_count": len(room_manager.get_connected_participants(clean_id))
            }
        ),
        exclude_participant_id=participant_id
    )

    try:
        while True:
            data = await websocket.receive_json()

            # Process event
            event_type = data.get("event_type")
            if not event_type:
                continue

            # Heartbeat handling
            if event_type == EventType.PING.value or event_type == "ping":
                await websocket.send_json(
                    Event(
                        event_type=EventType.PONG,
                        session_id=clean_id,
                        sender_id="system",
                        payload={"reply_to": data.get("event_id")}
                    ).model_dump()
                )
                continue

            # Construct typed event
            event = Event(
                event_type=EventType(event_type),
                session_id=clean_id,
                sender_id=participant_id,
                sender_role=participant.role,
                payload=data.get("payload", {})
            )

            # Broadcast event to room
            await room_manager.broadcast_to_room(
                session_id=clean_id,
                event=event,
                exclude_participant_id=participant_id
            )

            # If it was a message, send delivery ack to sender
            if event.event_type == EventType.MESSAGE_CREATED:
                await websocket.send_json(
                    Event(
                        event_type=EventType.MESSAGE_DELIVERED,
                        session_id=clean_id,
                        sender_id="system",
                        payload={
                            "message_id": event.payload.get("message_id"),
                            "delivered_to": room_manager.get_connected_participants(clean_id)
                        }
                    ).model_dump()
                )

    except WebSocketDisconnect:
        logger.info(f"WebSocket closed normally for {participant_id} in {clean_id}")
    except Exception as e:
        logger.warning(f"WebSocket exception for {participant_id}: {e}")
    finally:
        room_manager.disconnect(clean_id, participant_id)
        participant.connection_status = ConnectionStatus.DISCONNECTED

        # Broadcast participant.left to others
        await room_manager.broadcast_to_room(
            session_id=clean_id,
            event=Event(
                event_type=EventType.PARTICIPANT_LEFT,
                session_id=clean_id,
                sender_id=participant_id,
                sender_role=participant.role,
                payload={"participant_id": participant_id}
            )
        )
