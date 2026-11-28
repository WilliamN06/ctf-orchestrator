from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from ctf.realtime import Broadcaster

router = APIRouter()


@router.websocket("/ws/scoreboard")
async def scoreboard_feed(ws: WebSocket) -> None:
    broadcaster: Broadcaster = ws.app.state.broadcaster
    await broadcaster.connect(ws)
    await broadcaster.send_scoreboard(ws.app.state.engine, ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        broadcaster.disconnect(ws)
