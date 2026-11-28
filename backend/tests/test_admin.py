from fastapi.testclient import TestClient

from tests.conftest import register

ADMIN = {"Authorization": "Bearer admin"}
SUBMIT = "/api/challenges/reverse-me/submit"
FLAG = "CTF{ghidra_g0d}"


def test_admin_routes_need_the_secret(client: TestClient, auth: dict[str, str]) -> None:
    assert client.get("/api/admin/teams").status_code == 403
    assert client.get("/api/admin/teams", headers=auth).status_code == 403
    assert client.get("/api/admin/teams", headers=ADMIN).status_code == 200


def test_stats(client: TestClient) -> None:
    a = register(client, "alpha")
    b = register(client, "bravo")
    client.post(SUBMIT, json={"flag": "x"}, headers=a)
    client.post(SUBMIT, json={"flag": FLAG}, headers=a)
    client.post(SUBMIT, json={"flag": FLAG}, headers=b)
    stats = client.get("/api/admin/challenges/reverse-me/stats", headers=ADMIN).json()
    assert stats["attempts"] == 3
    assert stats["wrong_attempts"] == 1
    assert stats["solves"] == 2
    assert stats["first_blood_team"] == "alpha"


def test_reset_clears_one_challenge(client: TestClient, auth: dict[str, str]) -> None:
    client.post(SUBMIT, json={"flag": FLAG}, headers=auth)
    client.post(
        "/api/challenges/substitution-cipher/submit",
        json={"flag": "CTF{fr3qu3ncy_4nalysis}"},
        headers=auth,
    )
    assert client.post("/api/admin/challenges/reverse-me/reset", headers=ADMIN).status_code == 204
    assert client.get("/api/scoreboard").json()[0]["score"] == 75


def test_closed_competition_rejects_submissions(client: TestClient, auth: dict[str, str]) -> None:
    client.put("/api/admin/competition", json={"is_open": False}, headers=ADMIN)
    assert client.post(SUBMIT, json={"flag": FLAG}, headers=auth).status_code == 403
    client.put("/api/admin/competition", json={"is_open": True}, headers=ADMIN)
    assert client.post(SUBMIT, json={"flag": FLAG}, headers=auth).json()["correct"]


def test_team_list_includes_scores(client: TestClient, auth: dict[str, str]) -> None:
    client.post(SUBMIT, json={"flag": FLAG}, headers=auth)
    teams = client.get("/api/admin/teams", headers=ADMIN).json()
    assert teams[0]["score"] == 175 and teams[0]["solves"] == 1
