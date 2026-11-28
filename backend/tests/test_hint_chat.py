import json

from fastapi import FastAPI
from fastapi.testclient import TestClient

from ctf.hints.providers import FakeProvider, Message, ProviderError
from tests.conftest import register

URL = "/api/challenges/jwt-jailbreak/hint-chat"


def reply(action: str, message: str) -> str:
    return json.dumps({"action": action, "message": message, "extraction_attempt": False})


def test_chat_requires_auth(client: TestClient) -> None:
    assert client.post(URL, json={"message": "hi"}).status_code == 401


def test_question_then_hint(app: FastAPI, client: TestClient, auth: dict[str, str]) -> None:
    app.state.provider = FakeProvider(
        [
            reply("ask_question", "What does the token header contain?"),
            reply("offer_hint", "Look at which algorithms the server accepts."),
        ]
    )
    first = client.post(URL, json={"message": "I'm stuck"}, headers=auth).json()
    assert first["action"] == "ask_question" and first["unlocked_hint"] is None

    second = client.post(URL, json={"message": "still stuck"}, headers=auth).json()
    assert second["unlocked_hint"]["position"] == 1

    detail = client.get("/api/challenges/jwt-jailbreak", headers=auth).json()
    assert [h["position"] for h in detail["unlocked_hints"]] == [1]


def test_history_is_stored_and_replayed(
    app: FastAPI, client: TestClient, auth: dict[str, str]
) -> None:
    fake = FakeProvider([reply("ask_question", "q1"), reply("ask_question", "q2")])
    app.state.provider = fake
    client.post(URL, json={"message": "one"}, headers=auth)
    client.post(URL, json={"message": "two"}, headers=auth)

    sent: list[Message] = fake.calls[1][1]
    assert [m["content"] for m in sent] == ["one", "q1", "two"]

    hist = client.get(URL, headers=auth).json()
    assert [(h["role"], h["content"]) for h in hist] == [
        ("user", "one"),
        ("assistant", "q1"),
        ("user", "two"),
        ("assistant", "q2"),
    ]


def test_conversations_are_per_team(app: FastAPI, client: TestClient, auth: dict[str, str]) -> None:
    app.state.provider = FakeProvider([reply("ask_question", "q")])
    client.post(URL, json={"message": "mine"}, headers=auth)
    other = register(client, "bravo")
    assert client.get(URL, headers=other).json() == []


def test_provider_failure_is_503(app: FastAPI, client: TestClient, auth: dict[str, str]) -> None:
    class Down:
        name = "down"

        def complete(self, *args: object) -> None:
            raise ProviderError("connection refused")

    app.state.provider = Down()
    resp = client.post(URL, json={"message": "hi"}, headers=auth)
    assert resp.status_code == 503
    assert client.get(URL, headers=auth).json() == []


def test_closed_competition_blocks_chat(
    app: FastAPI, client: TestClient, auth: dict[str, str]
) -> None:
    app.state.provider = FakeProvider([reply("ask_question", "q")])
    client.put(
        "/api/admin/competition", json={"is_open": False}, headers={"Authorization": "Bearer admin"}
    )
    assert client.post(URL, json={"message": "hi"}, headers=auth).status_code == 403
