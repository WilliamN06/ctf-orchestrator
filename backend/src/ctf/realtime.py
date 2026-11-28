import logging

from fastapi import WebSocket
from sqlalchemy import Engine
from sqlmodel import Session

from ctf.routes.scoreboard import build_scoreboard

log = logging.getLogger(__name__)


class Broadcaster:
    def __init__(self) -> None:
        self.clients: set[WebSocket] = set()

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.clients.add(ws)

    def disconnect(self, ws: WebSocket) -> None:
        self.clients.discard(ws)

    async def send_scoreboard(self, engine: Engine, ws: WebSocket | None = None) -> None:
        with Session(engine) as session:
            payload = {
                "type": "scoreboard",
                "data": [e.model_dump(mode="json") for e in build_scoreboard(session)],
            }
        targets = [ws] if ws else list(self.clients)
        for client in targets:
            try:
                await client.send_json(payload)
            except Exception:  # client went away mid-send
                log.debug("dropping websocket client", exc_info=True)
                self.disconnect(client)
