from dataclasses import dataclass

from ctf.hints.prompts import v1_system_prompt
from ctf.hints.providers import LLMProvider, Message
from ctf.hints.reply import HintReply, ReplyOutcome, get_reply
from ctf.models import Challenge, Hint


@dataclass
class HintContext:
    challenge: Challenge
    hints: list[Hint]  # every hint for the challenge, in order
    unlocked: int  # how many the team already has
    history: list[Message]


@dataclass
class AgentTurn:
    reply: HintReply
    unlock: Hint | None
    outcome: ReplyOutcome
    system_prompt: str


class HintAgent:
    def __init__(self, provider: LLMProvider) -> None:
        self.provider = provider

    def respond(self, ctx: HintContext, message: str) -> AgentTurn:
        return self._respond_v1(ctx, message)

    def _respond_v1(self, ctx: HintContext, message: str) -> AgentTurn:
        # Baseline: the model sees everything and decides for itself when a hint is due.
        system = v1_system_prompt(ctx.challenge, ctx.hints, ctx.unlocked)
        outcome = get_reply(self.provider, system, [*ctx.history, _user(message)])
        unlock = None
        if outcome.reply.action == "offer_hint" and ctx.unlocked < len(ctx.hints):
            unlock = ctx.hints[ctx.unlocked]
        return AgentTurn(outcome.reply, unlock, outcome, system)


def _user(text: str) -> Message:
    return {"role": "user", "content": text}
