from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, col, select

from ctf.deps import SessionDep, TeamDep
from ctf.models import Challenge, ChallengeView, Hint, HintUnlock, Solve
from ctf.schemas import ChallengeDetail, ChallengeSummary, UnlockedHint

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


def _counts(session: Session) -> tuple[dict[int, int], dict[int, int]]:
    hints = session.exec(
        select(Hint.challenge_id, func.count()).group_by(col(Hint.challenge_id))
    ).all()
    solves = session.exec(
        select(Solve.challenge_id, func.count()).group_by(col(Solve.challenge_id))
    ).all()
    return dict(hints), dict(solves)


def _summary(
    ch: Challenge, hint_counts: dict[int, int], solve_counts: dict[int, int]
) -> ChallengeSummary:
    assert ch.id is not None
    return ChallengeSummary(
        slug=ch.slug,
        name=ch.name,
        category=ch.category,
        difficulty=ch.difficulty,
        points=ch.points,
        description=ch.description,
        hint_count=hint_counts.get(ch.id, 0),
        solves=solve_counts.get(ch.id, 0),
    )


def get_challenge(session: Session, slug: str) -> Challenge:
    ch = session.exec(select(Challenge).where(col(Challenge.slug) == slug)).first()
    if ch is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Unknown challenge")
    return ch


@router.get("")
def list_challenges(session: SessionDep) -> list[ChallengeSummary]:
    hint_counts, solve_counts = _counts(session)
    challenges = session.exec(select(Challenge).order_by(col(Challenge.points))).all()
    return [_summary(ch, hint_counts, solve_counts) for ch in challenges]


@router.get("/{slug}")
def challenge_detail(slug: str, session: SessionDep, team: TeamDep) -> ChallengeDetail:
    ch = get_challenge(session, slug)
    assert ch.id is not None and team.id is not None

    # first view starts the "stuck" clock used by the hint policy
    if session.get(ChallengeView, (team.id, ch.id)) is None:
        session.add(ChallengeView(team_id=team.id, challenge_id=ch.id))
        session.commit()

    unlocked = session.exec(
        select(Hint, HintUnlock)
        .join(
            HintUnlock,
            (col(HintUnlock.challenge_id) == col(Hint.challenge_id))
            & (col(HintUnlock.position) == col(Hint.position)),
        )
        .where(col(HintUnlock.team_id) == team.id, col(Hint.challenge_id) == ch.id)
        .order_by(col(Hint.position))
    ).all()

    hint_counts, solve_counts = _counts(session)
    return ChallengeDetail(
        **_summary(ch, hint_counts, solve_counts).model_dump(),
        solved=session.get(Solve, (team.id, ch.id)) is not None,
        unlocked_hints=[
            UnlockedHint(position=h.position, text=h.text, unlocked_at=u.unlocked_at)
            for h, u in unlocked
        ],
    )
