from fastapi.testclient import TestClient
from sqlmodel import Session, select

from ctf.models import Attempt
from tests.conftest import register

URL = "/api/challenges/jwt-jailbreak/submit"
FLAG = "CTF{alg0rithm_c0nfusion}"


def test_wrong_flag(client: TestClient, auth: dict[str, str]) -> None:
    resp = client.post(URL, json={"flag": "CTF{nope}"}, headers=auth)
    assert resp.status_code == 200
    assert resp.json()["correct"] is False


def test_correct_flag_scores_with_first_blood(client: TestClient, auth: dict[str, str]) -> None:
    data = client.post(URL, json={"flag": FLAG}, headers=auth).json()
    assert data == {"correct": True, "already_solved": False, "first_blood": True, "points": 300}


def test_whitespace_around_flag_is_ignored(client: TestClient, auth: dict[str, str]) -> None:
    assert client.post(URL, json={"flag": f"  {FLAG}\n"}, headers=auth).json()["correct"]


def test_second_solve_is_not_counted(client: TestClient, auth: dict[str, str]) -> None:
    client.post(URL, json={"flag": FLAG}, headers=auth)
    data = client.post(URL, json={"flag": FLAG}, headers=auth).json()
    assert data["already_solved"] is True
    assert data["points"] == 0


def test_only_first_team_gets_first_blood(client: TestClient, auth: dict[str, str]) -> None:
    other = register(client, "SegFault Society")
    client.post(URL, json={"flag": FLAG}, headers=auth)
    data = client.post(URL, json={"flag": FLAG}, headers=other).json()
    assert data["correct"] and not data["first_blood"]


def test_submitted_text_is_not_stored(
    client: TestClient, session: Session, auth: dict[str, str]
) -> None:
    client.post(URL, json={"flag": "CTF{my_guess}"}, headers=auth)
    attempt = session.exec(select(Attempt)).one()
    assert "my_guess" not in str(attempt.model_dump())


def test_throttled_after_limit(client: TestClient, auth: dict[str, str]) -> None:
    for _ in range(10):
        assert client.post(URL, json={"flag": "x"}, headers=auth).status_code == 200
    resp = client.post(URL, json={"flag": FLAG}, headers=auth)
    assert resp.status_code == 429
    assert 1 <= int(resp.headers["Retry-After"]) <= 60


def test_throttle_is_per_team(client: TestClient, auth: dict[str, str]) -> None:
    for _ in range(10):
        client.post(URL, json={"flag": "x"}, headers=auth)
    other = register(client, "ByteBenders")
    assert client.post(URL, json={"flag": "x"}, headers=other).status_code == 200


def test_submit_requires_auth(client: TestClient) -> None:
    assert client.post(URL, json={"flag": FLAG}).status_code == 401
