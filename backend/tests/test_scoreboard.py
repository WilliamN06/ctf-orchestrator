from fastapi.testclient import TestClient

from tests.conftest import register

FLAGS = {
    "substitution-cipher": "CTF{fr3qu3ncy_4nalysis}",  # 75
    "buffer-overflow-101": "CTF{stack_sm4shed}",  # 100
    "reverse-me": "CTF{ghidra_g0d}",  # 175
}


def solve(client: TestClient, headers: dict[str, str], slug: str) -> None:
    resp = client.post(
        f"/api/challenges/{slug}/submit", json={"flag": FLAGS[slug]}, headers=headers
    )
    assert resp.json()["correct"]


def test_empty_teams_are_listed_with_zero(client: TestClient, auth: dict[str, str]) -> None:
    board = client.get("/api/scoreboard").json()
    assert board[0]["score"] == 0 and board[0]["last_solve"] is None


def test_ordered_by_score(client: TestClient) -> None:
    a = register(client, "alpha")
    b = register(client, "bravo")
    solve(client, a, "substitution-cipher")
    solve(client, b, "reverse-me")
    board = client.get("/api/scoreboard").json()
    assert [(r["name"], r["score"], r["rank"]) for r in board] == [
        ("bravo", 175, 1),
        ("alpha", 75, 2),
    ]


def test_tie_goes_to_earlier_finisher(client: TestClient) -> None:
    a = register(client, "alpha")
    b = register(client, "bravo")
    solve(client, b, "reverse-me")
    solve(client, a, "substitution-cipher")
    solve(client, a, "buffer-overflow-101")
    board = client.get("/api/scoreboard").json()
    assert board[0]["name"] == "bravo"
    assert board[0]["score"] == board[1]["score"] == 175


def test_solves_counted(client: TestClient, auth: dict[str, str]) -> None:
    solve(client, auth, "substitution-cipher")
    solve(client, auth, "buffer-overflow-101")
    assert client.get("/api/scoreboard").json()[0]["solves"] == 2
