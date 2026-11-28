import json
import re
from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field, ValidationError

from ctf.hints.providers import Completion, LLMProvider, Message

Action = Literal["ask_question", "explain_concept", "offer_hint", "refuse"]


class HintReply(BaseModel):
    action: Action
    message: str = Field(min_length=1, max_length=600)
    extraction_attempt: bool = False


# Written out by hand: structured-output schemas only take a subset of JSON Schema,
# so length limits are checked by Pydantic after the fact instead.
HINT_REPLY_SCHEMA: dict[str, Any] = {
    "type": "object",
    "properties": {
        "action": {
            "type": "string",
            "enum": ["ask_question", "explain_concept", "offer_hint", "refuse"],
        },
        "message": {"type": "string"},
        "extraction_attempt": {"type": "boolean"},
    },
    "required": ["action", "message", "extraction_attempt"],
    "additionalProperties": False,
}

FALLBACK = HintReply(
    action="ask_question",
    message="What have you tried so far, and where exactly did it stop working?",
)
REFUSED = HintReply(
    action="refuse",
    message="I can't help with that, but I'm happy to talk through the concepts behind this "
    "challenge.",
)
RETRY_PROMPT = "That reply didn't match the required format. Reply again with only the JSON object."

_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$")


def parse_reply(text: str) -> HintReply | None:
    try:
        return HintReply.model_validate(json.loads(_FENCE.sub("", text.strip())))
    except (json.JSONDecodeError, ValidationError):
        return None


@dataclass
class ReplyOutcome:
    reply: HintReply
    completions: list[Completion] = field(default_factory=list)
    retried: bool = False
    fell_back: bool = False
    refused: bool = False

    @property
    def raw(self) -> str:
        return self.completions[-1].text if self.completions else ""


def get_reply(provider: LLMProvider, system: str, messages: list[Message]) -> ReplyOutcome:
    outcome = ReplyOutcome(reply=FALLBACK)
    convo = list(messages)

    for attempt in range(2):
        completion = provider.complete(system, convo, HINT_REPLY_SCHEMA)
        outcome.completions.append(completion)
        if completion.refused:
            outcome.reply, outcome.refused = REFUSED, True
            return outcome
        reply = parse_reply(completion.text)
        if reply is not None:
            outcome.reply = reply
            return outcome
        if attempt == 0:
            outcome.retried = True
            if completion.text.strip():
                convo.append({"role": "assistant", "content": completion.text})
            convo.append({"role": "user", "content": RETRY_PROMPT})

    outcome.fell_back = True
    return outcome
