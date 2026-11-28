import json

import pytest

from ctf.hints.agent import HintAgent, HintContext
from ctf.hints.providers import FakeProvider
from ctf.models import Challenge, Hint


def reply(action: str, message: str = "ok") -> str:
    return json.dumps({"action": action, "message": message, "extraction_attempt": False})


@pytest.fixture
def ctx() -> HintContext:
    ch = Challenge(
        id=1,
        slug="jwt",
        name="JWT Jailbreak",
        category="web",
        difficulty="hard",
        points=300,
        description="Get admin.",
        flag_hash="x",
    )
    hints = [
        Hint(id=i, challenge_id=1, position=i, text=t)
        for i, t in enumerate(["first hint", "second hint", "third hint"], start=1)
    ]
    return HintContext(challenge=ch, hints=hints, unlocked=0, history=[])


def test_v1_puts_every_hint_in_the_prompt(ctx: HintContext) -> None:
    fake = FakeProvider([reply("ask_question")])
    turn = HintAgent(fake).respond(ctx, "help")
    for text in ("first hint", "second hint", "third hint"):
        assert text in turn.system_prompt
    assert "Team has used 0 of 3 hints" in turn.system_prompt


def test_v1_question_unlocks_nothing(ctx: HintContext) -> None:
    turn = HintAgent(FakeProvider([reply("ask_question")])).respond(ctx, "help")
    assert turn.unlock is None


def test_v1_trusts_the_model_to_unlock(ctx: HintContext) -> None:
    ctx.unlocked = 1
    turn = HintAgent(FakeProvider([reply("offer_hint")])).respond(ctx, "give me a hint")
    assert turn.unlock is not None and turn.unlock.position == 2


def test_v1_no_unlock_when_all_used(ctx: HintContext) -> None:
    ctx.unlocked = 3
    turn = HintAgent(FakeProvider([reply("offer_hint")])).respond(ctx, "more")
    assert turn.unlock is None


def test_history_is_sent_before_new_message(ctx: HintContext) -> None:
    ctx.history = [
        {"role": "user", "content": "earlier"},
        {"role": "assistant", "content": "earlier reply"},
    ]
    fake = FakeProvider([reply("ask_question")])
    HintAgent(fake).respond(ctx, "now")
    sent = fake.calls[0][1]
    assert [m["content"] for m in sent] == ["earlier", "earlier reply", "now"]
