import math
from datetime import timedelta

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func
from sqlmodel import Session, col, select

from ctf.deps import SessionDep, SettingsDep, TeamDep
from ctf.models import (
    Attempt,
    Challenge,
    ChallengeView,
    Hint,
    HintUnlock,
    Solve,
    as_utc,
    utcnow,
)
from ctf.schemas import (
    ChallengeDetail,
    ChallengeSummary,
    FlagResult,
    FlagSubmit,
    UnlockedHint,
)
from ctf.security import check_flag

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


def _throttle(session: Session, team_id: int, challenge_id: int, limit: int, window: int) -> None:
    now = utcnow()
    recent = session.exec(
        select(Attempt.created_at)
        .where(
            col(Attempt.team_id) == team_id,
            col(Attempt.challenge_id) == challenge_id,
            col(Attempt.created_at) > now - timedelta(seconds=window),
        )
        .order_by(col(Attempt.created_at))
    ).all()
    if len(recent) >= limit:
        oldest = as_utc(recent[0])
        retry_after = max(1, math.ceil((oldest + timedelta(seconds=window) - now).total_seconds()))
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many attempts, slow down",
            headers={"Retry-After": str(retry_after)},
        )


@router.post("/{slug}/submit")
def submit_flag(
    slug: str, body: FlagSubmit, session: SessionDep, team: TeamDep, settings: SettingsDep
) -> FlagResult:
    ch = get_challenge(session, slug)
    assert ch.id is not None and team.id is not None

    _throttle(session, team.id, ch.id, settings.submit_limit, settings.submit_window_seconds)

    correct = check_flag(settings.flag_secret, body.flag, ch.flag_hash)
    session.add(Attempt(team_id=team.id, challenge_id=ch.id, correct=correct))

    if not correct:
        session.commit()
        return FlagResult(correct=False)

    if session.get(Solve, (team.id, ch.id)) is not None:
        session.commit()
        return FlagResult(correct=True, already_solved=True)

    earlier = session.exec(select(Solve).where(col(Solve.challenge_id) == ch.id)).first()
    first_blood = earlier is None
    session.add(Solve(team_id=team.id, challenge_id=ch.id, first_blood=first_blood))
    session.commit()
    return FlagResult(correct=True, first_blood=first_blood, points=ch.points)
