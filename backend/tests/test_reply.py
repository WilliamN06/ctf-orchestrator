import json

from ctf.hints.providers import Completion, FakeProvider, Message
from ctf.hints.reply import FALLBACK, REFUSED, RETRY_PROMPT, get_reply, parse_reply

MSGS: list[Message] = [{"role": "user", "content": "I'm stuck"}]


def reply_json(action: str = "ask_question", message: str = "What did you try?") -> str:
    return json.dumps({"action": action, "message": message, "extraction_attempt": False})


def test_parse_accepts_valid_and_code_fenced_json() -> None:
    assert parse_reply(reply_json()) is not None
    fenced = f"```json\n{reply_json('offer_hint', 'Here you go')}\n```"
    parsed = parse_reply(fenced)
    assert parsed is not None and parsed.action == "offer_hint"


def test_parse_rejects_bad_output() -> None:
    assert parse_reply("sure! here's a hint") is None
    assert parse_reply(json.dumps({"action": "give_flag", "message": "x"})) is None
    assert parse_reply(reply_json(message="")) is None
    assert parse_reply(reply_json(message="x" * 601)) is None


def test_valid_first_time() -> None:
    out = get_reply(FakeProvider([reply_json()]), "sys", MSGS)
    assert out.reply.message == "What did you try?"
    assert not out.retried and not out.fell_back


def test_invalid_then_valid_retries_once() -> None:
    fake = FakeProvider(["not json", reply_json("explain_concept", "A JWT has three parts.")])
    out = get_reply(fake, "sys", MSGS)
    assert out.retried and not out.fell_back
    assert out.reply.action == "explain_concept"
    retry_msgs = fake.calls[1][1]
    assert retry_msgs[-2] == {"role": "assistant", "content": "not json"}
    assert retry_msgs[-1]["content"] == RETRY_PROMPT


def test_invalid_twice_falls_back() -> None:
    out = get_reply(FakeProvider(["nope", "still nope"]), "sys", MSGS)
    assert out.fell_back and out.reply == FALLBACK
    assert len(out.completions) == 2


def test_empty_reply_is_not_echoed_back() -> None:
    fake = FakeProvider(["", reply_json()])
    get_reply(fake, "sys", MSGS)
    assert all(m["content"] for m in fake.calls[1][1])


def test_refusal_short_circuits() -> None:
    class Refuser:
        name = "refuser"

        def complete(self, system: str, messages: list[Message], schema: object) -> Completion:
            return Completion(text="", model="x", refused=True)

    out = get_reply(Refuser(), "sys", MSGS)  # type: ignore[arg-type]
    assert out.refused and out.reply == REFUSED
