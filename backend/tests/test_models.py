import pytest
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from ctf.models import Challenge, Solve, Team


def make_challenge(session: Session, slug: str = "c1") -> Challenge:
    ch = Challenge(
        slug=slug,
        name="C",
        category="web",
        difficulty="easy",
        points=100,
        description="d",
        flag_hash="x",
    )
    session.add(ch)
    session.commit()
    session.refresh(ch)
    return ch


def test_team_names_are_unique(session: Session) -> None:
    session.add(Team(name="a", token_hash="1"))
    session.commit()
    session.add(Team(name="a", token_hash="2"))
    with pytest.raises(IntegrityError):
        session.commit()


def test_team_can_only_solve_once(session: Session) -> None:
    team = Team(name="a", token_hash="1")
    session.add(team)
    session.commit()
    ch = make_challenge(session)
    assert team.id is not None and ch.id is not None
    session.add(Solve(team_id=team.id, challenge_id=ch.id))
    session.commit()
    session.add(Solve(team_id=team.id, challenge_id=ch.id))
    with pytest.raises(IntegrityError):
        session.commit()
