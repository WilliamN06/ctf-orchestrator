from fastapi.testclient import TestClient
from sqlmodel import Session, select

from ctf.models import Team


def test_register_returns_token_once_and_stores_hash(client: TestClient, session: Session) -> None:
    resp = client.post("/api/teams", json={"name": "HeapHunters"})
    assert resp.status_code == 201
    token = resp.json()["token"]
    stored = session.exec(select(Team)).one()
    assert token not in stored.token_hash


def test_duplicate_name_conflicts(client: TestClient) -> None:
    client.post("/api/teams", json={"name": "dup"})
    assert client.post("/api/teams", json={"name": "dup"}).status_code == 409


def test_bad_names_rejected(client: TestClient) -> None:
    assert client.post("/api/teams", json={"name": "x"}).status_code == 422
    assert client.post("/api/teams", json={"name": "<script>"}).status_code == 422


def test_me_requires_valid_token(client: TestClient, auth: dict[str, str]) -> None:
    assert client.get("/api/teams/me", headers=auth).json()["name"] == "NullPointers"
    assert client.get("/api/teams/me").status_code == 401
    bad = {"Authorization": "Bearer nope"}
    assert client.get("/api/teams/me", headers=bad).status_code == 401
