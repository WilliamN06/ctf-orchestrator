from fastapi.testclient import TestClient

from tests.conftest import register


def test_scoreboard_sent_on_connect(client: TestClient, auth: dict[str, str]) -> None:
    with client.websocket_connect("/ws/scoreboard") as ws:
        msg = ws.receive_json()
    assert msg["type"] == "scoreboard"
    assert msg["data"][0]["name"] == "NullPointers"


def test_solve_pushes_update(client: TestClient) -> None:
    team = register(client, "alpha")
    with client.websocket_connect("/ws/scoreboard") as ws:
        assert ws.receive_json()["data"][0]["score"] == 0
        client.post(
            "/api/challenges/reverse-me/submit", json={"flag": "CTF{ghidra_g0d}"}, headers=team
        )
        update = ws.receive_json()
    assert update["data"][0]["score"] == 175


def test_wrong_flag_does_not_push(client: TestClient) -> None:
    team = register(client, "alpha")
    with client.websocket_connect("/ws/scoreboard") as ws:
        ws.receive_json()
        client.post("/api/challenges/reverse-me/submit", json={"flag": "nope"}, headers=team)
        client.post(
            "/api/challenges/reverse-me/submit", json={"flag": "CTF{ghidra_g0d}"}, headers=team
        )
        # the next message is the solve, not something from the wrong guess
        assert ws.receive_json()["data"][0]["solves"] == 1
