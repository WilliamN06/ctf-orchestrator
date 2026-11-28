from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlmodel import col, delete, select

from ctf.deps import SessionDep, get_competition, require_admin
from ctf.models import Attempt, ChallengeView, ChatMessage, HintUnlock, Solve, Team
from ctf.routes.challenges import get_challenge
from ctf.routes.scoreboard import build_scoreboard
from ctf.schemas import AdminTeam, ChallengeStats, CompetitionState

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])

PER_CHALLENGE: list[Any] = [Attempt, Solve, HintUnlock, ChatMessage, ChallengeView]


@router.get("/challenges/{slug}/stats")
def challenge_stats(slug: str, session: SessionDep) -> ChallengeStats:
    ch = get_challenge(session, slug)

    def count(model: Any, *where: Any) -> int:
        stmt = select(func.count()).select_from(model).where(model.challenge_id == ch.id, *where)
        return int(session.exec(stmt).one())

    first = session.exec(
        select(Team.name)
        .join(Solve, col(Solve.team_id) == col(Team.id))
        .where(col(Solve.challenge_id) == ch.id, col(Solve.first_blood).is_(True))
    ).first()
    return ChallengeStats(
        slug=ch.slug,
        attempts=count(Attempt),
        wrong_attempts=count(Attempt, col(Attempt.correct).is_(False)),
        solves=count(Solve),
        first_blood_team=first,
        hint_unlocks=count(HintUnlock),
        chat_messages=count(ChatMessage),
        guard_blocks=count(ChatMessage, col(ChatMessage.guard_blocked).is_(True)),
    )


@router.post("/challenges/{slug}/reset", status_code=204)
def reset_challenge(slug: str, session: SessionDep) -> None:
    ch = get_challenge(session, slug)
    for model in PER_CHALLENGE:
        session.execute(delete(model).where(model.challenge_id == ch.id))
    session.commit()


@router.get("/teams")
def list_teams(session: SessionDep) -> list[AdminTeam]:
    board = {e.team_id: e for e in build_scoreboard(session)}
    teams = session.exec(select(Team).order_by(col(Team.created_at))).all()
    out = []
    for t in teams:
        assert t.id is not None
        entry = board[t.id]
        out.append(
            AdminTeam(
                id=t.id,
                name=t.name,
                country=t.country,
                created_at=t.created_at,
                score=entry.score,
                solves=entry.solves,
            )
        )
    return out


@router.get("/competition")
def competition_state(session: SessionDep) -> CompetitionState:
    return CompetitionState(is_open=get_competition(session).is_open)


@router.put("/competition")
def set_competition(body: CompetitionState, session: SessionDep) -> CompetitionState:
    comp = get_competition(session)
    comp.is_open = body.is_open
    session.add(comp)
    session.commit()
    return CompetitionState(is_open=comp.is_open)
