from typing import Dict, List, Optional
from fastapi import WebSocket
import logging
from ..models.events import Event, EventType
from ..models.session import ConnectionStatus

logger = logging.getLogger("interact.room_manager")

class RoomManager:
    def __init__(self):
        # session_id -> { participant_id: WebSocket }
        self._rooms: Dict[str, Dict[str, WebSocket]] = {}

    async def connect(self, session_id: str, participant_id: str, websocket: WebSocket):
        await websocket.accept()
        clean_id = session_id.strip().upper()

        if clean_id not in self._rooms:
            self._rooms[clean_id] = {}

        self._rooms[clean_id][participant_id] = websocket
        logger.info(f"Participant {participant_id} connected to session {clean_id}")

    def disconnect(self, session_id: str, participant_id: str):
        clean_id = session_id.strip().upper()
        if clean_id in self._rooms and participant_id in self._rooms[clean_id]:
            del self._rooms[clean_id][participant_id]
            logger.info(f"Participant {participant_id} disconnected from session {clean_id}")
            if not self._rooms[clean_id]:
                del self._rooms[clean_id]

    async def broadcast_to_room(
        self,
        session_id: str,
        event: Event,
        exclude_participant_id: Optional[str] = None
    ):
        clean_id = session_id.strip().upper()
        room = self._rooms.get(clean_id, {})
        data = event.model_dump()

        dead_connections = []
        for pid, ws in room.items():
            if exclude_participant_id and pid == exclude_participant_id:
                continue
            try:
                await ws.send_json(data)
            except Exception as e:
                logger.warning(f"Failed to send to {pid} in {clean_id}: {e}")
                dead_connections.append(pid)

        # Cleanup dead sockets
        for dead_pid in dead_connections:
            self.disconnect(clean_id, dead_pid)

    async def send_to_participant(
        self,
        session_id: str,
        participant_id: str,
        event: Event
    ) -> bool:
        clean_id = session_id.strip().upper()
        room = self._rooms.get(clean_id, {})
        ws = room.get(participant_id)

        if not ws:
            return False

        try:
            await ws.send_json(event.model_dump())
            return True
        except Exception as e:
            logger.warning(f"Error sending directly to {participant_id}: {e}")
            self.disconnect(clean_id, participant_id)
            return False

    def get_connected_participants(self, session_id: str) -> List[str]:
        clean_id = session_id.strip().upper()
        return list(self._rooms.get(clean_id, {}).keys())

room_manager = RoomManager()
