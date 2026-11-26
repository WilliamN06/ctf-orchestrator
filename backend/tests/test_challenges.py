import json

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session, select

from ctf.models import Challenge, ChallengeView, Hint, HintUnlock, Team


def _all_secrets(app: FastAPI, session: Session) -> list[str]:
    flags = list(app.state.flags.values())
    hints = [h.text for h in session.exec(select(Hint)).all()]
    return flags + hints


def test_list_has_no_flags_or_hint_text(app: FastAPI, client: TestClient, session: Session) -> None:
    resp = client.get("/api/challenges")
    assert resp.status_code == 200
    body = resp.text
    assert len(resp.json()) == 8
    for secret in _all_secrets(app, session):
        assert secret not in body
    assert "flag" not in json.loads(body)[0]


def test_detail_requires_auth(client: TestClient) -> None:
    assert client.get("/api/challenges/jwt-jailbreak").status_code == 401


def test_detail_hides_locked_hints(
    app: FastAPI, client: TestClient, session: Session, auth: dict[str, str]
) -> None:
    resp = client.get("/api/challenges/jwt-jailbreak", headers=auth)
    assert resp.status_code == 200
    data = resp.json()
    assert data["hint_count"] == 3
    assert data["unlocked_hints"] == []
    assert data["solved"] is False
    for secret in _all_secrets(app, session):
        assert secret not in resp.text


def test_detail_shows_only_unlocked_hints(
    client: TestClient, session: Session, auth: dict[str, str]
) -> None:
    team = session.exec(select(Team)).one()
    ch = session.exec(select(Challenge).where(Challenge.slug == "jwt-jailbreak")).one()
    assert team.id and ch.id
    session.add(HintUnlock(team_id=team.id, challenge_id=ch.id, position=1))
    session.commit()

    data = client.get("/api/challenges/jwt-jailbreak", headers=auth).json()
    assert [h["position"] for h in data["unlocked_hints"]] == [1]
    assert "more than one" in data["unlocked_hints"][0]["text"]
    assert "set it to none" not in str(data)


def test_first_view_is_recorded_once(
    client: TestClient, session: Session, auth: dict[str, str]
) -> None:
    client.get("/api/challenges/reverse-me", headers=auth)
    client.get("/api/challenges/reverse-me", headers=auth)
    assert len(session.exec(select(ChallengeView)).all()) == 1


def test_unknown_challenge_404(client: TestClient, auth: dict[str, str]) -> None:
    assert client.get("/api/challenges/nope", headers=auth).status_code == 404
