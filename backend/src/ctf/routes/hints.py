import logging
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlmodel import col, select

from ctf.deps import SessionDep, TeamDep, require_open
from ctf.hints.agent import HintAgent, HintContext
from ctf.hints.providers import LLMProvider, Message, ProviderError, make_provider
from ctf.hints.reply import Action
from ctf.models import ChatMessage, Hint, HintUnlock
from ctf.routes.challenges import get_challenge
from ctf.schemas import UnlockedHint

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/challenges/{slug}/hint-chat", tags=["hints"])


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=1000)


class ChatResponse(BaseModel):
    action: Action
    message: str
    unlocked_hint: UnlockedHint | None


class ChatEntry(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    action: str | None
    created_at: datetime


def get_provider(request: Request) -> LLMProvider:
    # built on first use so the app still starts without an API key or Ollama running
    if getattr(request.app.state, "provider", None) is None:
        request.app.state.provider = make_provider(request.app.state.settings)
    provider: LLMProvider = request.app.state.provider
    return provider


@router.get("")
def history(slug: str, session: SessionDep, team: TeamDep) -> list[ChatEntry]:
    ch = get_challenge(session, slug)
    rows = session.exec(
        select(ChatMessage)
        .where(col(ChatMessage.team_id) == team.id, col(ChatMessage.challenge_id) == ch.id)
        .order_by(col(ChatMessage.id))
    ).all()
    return [
        ChatEntry(role=r.role, content=r.content, action=r.action, created_at=r.created_at)
        for r in rows
    ]


@router.post("", dependencies=[Depends(require_open)])
def chat(
    slug: str,
    body: ChatRequest,
    session: SessionDep,
    team: TeamDep,
    provider: Annotated[LLMProvider, Depends(get_provider)],
) -> ChatResponse:
    ch = get_challenge(session, slug)
    assert ch.id is not None and team.id is not None

    hints = list(
        session.exec(
            select(Hint).where(col(Hint.challenge_id) == ch.id).order_by(col(Hint.position))
        ).all()
    )
    unlocked = len(
        session.exec(
            select(HintUnlock).where(
                col(HintUnlock.team_id) == team.id, col(HintUnlock.challenge_id) == ch.id
            )
        ).all()
    )
    past = session.exec(
        select(ChatMessage)
        .where(col(ChatMessage.team_id) == team.id, col(ChatMessage.challenge_id) == ch.id)
        .order_by(col(ChatMessage.id))
    ).all()
    history_msgs: list[Message] = [
        {"role": "user" if m.role == "user" else "assistant", "content": m.content} for m in past
    ]

    ctx = HintContext(challenge=ch, hints=hints, unlocked=unlocked, history=history_msgs)
    try:
        turn = HintAgent(provider).respond(ctx, body.message)
    except ProviderError:
        log.exception("hint provider failed")
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE, "The hint assistant is unavailable right now"
        ) from None

    session.add(ChatMessage(team_id=team.id, challenge_id=ch.id, role="user", content=body.message))
    session.add(
        ChatMessage(
            team_id=team.id,
            challenge_id=ch.id,
            role="assistant",
            content=turn.reply.message,
            action=turn.reply.action,
        )
    )
    unlocked_hint = None
    if turn.unlock is not None:
        row = HintUnlock(team_id=team.id, challenge_id=ch.id, position=turn.unlock.position)
        session.add(row)
        unlocked_hint = UnlockedHint(
            position=turn.unlock.position, text=turn.unlock.text, unlocked_at=row.unlocked_at
        )
    session.commit()

    return ChatResponse(
        action=turn.reply.action, message=turn.reply.message, unlocked_hint=unlocked_hint
    )
