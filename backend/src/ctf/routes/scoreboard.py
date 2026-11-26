from datetime import datetime

from fastapi import APIRouter
from sqlmodel import Session, col, select

from ctf.deps import SessionDep
from ctf.models import Challenge, Solve, Team, as_utc
from ctf.schemas import ScoreboardEntry

router = APIRouter(prefix="/api/scoreboard", tags=["scoreboard"])


def build_scoreboard(session: Session) -> list[ScoreboardEntry]:
    totals: dict[int, tuple[int, int, datetime | None]] = {}
    rows = session.exec(
        select(Solve.team_id, Challenge.points, Solve.solved_at).join(
            Challenge, col(Challenge.id) == col(Solve.challenge_id)
        )
    ).all()
    for team_id, points, solved_at in rows:
        score, solves, last = totals.get(team_id, (0, 0, None))
        solved_at = as_utc(solved_at)
        totals[team_id] = (score + points, solves + 1, max(last, solved_at) if last else solved_at)

    teams = session.exec(select(Team)).all()

    def sort_key(team: Team) -> tuple[int, float, str]:
        score, _, last = totals.get(team.id or 0, (0, 0, None))
        # higher score first; on a tie, whoever got there first
        return (-score, last.timestamp() if last else float("inf"), team.name.lower())

    board = []
    for rank, team in enumerate(sorted(teams, key=sort_key), start=1):
        assert team.id is not None
        score, solves, last = totals.get(team.id, (0, 0, None))
        board.append(
            ScoreboardEntry(
                rank=rank,
                team_id=team.id,
                name=team.name,
                country=team.country,
                score=score,
                solves=solves,
                last_solve=last,
            )
        )
    return board


@router.get("")
def scoreboard(session: SessionDep) -> list[ScoreboardEntry]:
    return build_scoreboard(session)
