import json

import httpx
import httpx2
import pytest

from ctf.hints.providers import (
    AnthropicProvider,
    FakeProvider,
    Message,
    OllamaProvider,
    ProviderError,
)

SCHEMA = {"type": "object", "properties": {"a": {"type": "string"}}, "required": ["a"]}
MSGS: list[Message] = [{"role": "user", "content": "hi"}]


def test_fake_replays_script_then_repeats_last() -> None:
    fake = FakeProvider(["one", lambda system, msgs: f"echo {msgs[-1]['content']}"])
    assert fake.complete("sys", MSGS, SCHEMA).text == "one"
    assert fake.complete("sys", MSGS, SCHEMA).text == "echo hi"
    assert fake.complete("sys", MSGS, SCHEMA).text == "echo hi"
    assert len(fake.calls) == 3


def test_anthropic_request_shape_and_parsing() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx2.Request) -> httpx2.Response:
        seen.update(json.loads(request.content))
        return httpx2.Response(
            200,
            json={
                "id": "msg_1",
                "type": "message",
                "role": "assistant",
                "model": "claude-haiku-5-5",
                "content": [{"type": "text", "text": '{"a": "b"}'}],
                "stop_reason": "end_turn",
                "stop_sequence": None,
                "usage": {"input_tokens": 12, "output_tokens": 4},
            },
        )

    provider = AnthropicProvider(
        api_key="test", http_client=httpx2.Client(transport=httpx2.MockTransport(handler))
    )
    out = provider.complete("be brief", MSGS, SCHEMA)

    assert out.text == '{"a": "b"}'
    assert (out.input_tokens, out.output_tokens) == (12, 4)
    assert not out.refused
    assert seen["system"] == "be brief"
    assert seen["output_config"] == {
        "effort": "low",
        "format": {"type": "json_schema", "schema": SCHEMA},
    }


def test_anthropic_refusal_is_flagged() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            200,
            json={
                "id": "msg_1",
                "type": "message",
                "role": "assistant",
                "model": "claude-haiku-5-5",
                "content": [],
                "stop_reason": "refusal",
                "stop_sequence": None,
                "usage": {"input_tokens": 1, "output_tokens": 0},
            },
        )

    provider = AnthropicProvider(
        api_key="test", http_client=httpx2.Client(transport=httpx2.MockTransport(handler))
    )
    out = provider.complete("s", MSGS, SCHEMA)
    assert out.refused and out.text == ""


def test_anthropic_api_errors_become_provider_errors() -> None:
    def handler(request: httpx2.Request) -> httpx2.Response:
        return httpx2.Response(
            400, json={"type": "error", "error": {"type": "invalid_request_error", "message": "x"}}
        )

    provider = AnthropicProvider(
        api_key="test", http_client=httpx2.Client(transport=httpx2.MockTransport(handler))
    )
    with pytest.raises(ProviderError):
        provider.complete("s", MSGS, SCHEMA)


def test_ollama_sends_system_first_and_schema() -> None:
    seen: dict[str, object] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={"message": {"content": '{"a": "b"}'}, "prompt_eval_count": 7, "eval_count": 3},
        )

    out = OllamaProvider(transport=httpx.MockTransport(handler)).complete("sys", MSGS, SCHEMA)
    assert out.text == '{"a": "b"}' and out.output_tokens == 3
    assert seen["messages"] == [{"role": "system", "content": "sys"}, *MSGS]
    assert seen["format"] == SCHEMA and seen["stream"] is False


def test_ollama_not_running() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("refused")

    with pytest.raises(ProviderError):
        OllamaProvider(transport=httpx.MockTransport(handler)).complete("s", MSGS, SCHEMA)
