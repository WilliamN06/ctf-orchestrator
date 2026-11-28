import time
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol, TypedDict, cast

import anthropic
import httpx
import httpx2
from anthropic.types import MessageParam, OutputConfigParam

from ctf.config import Settings

Effort = Literal["low", "medium", "high", "xhigh", "max"]


class Message(TypedDict):
    role: Literal["user", "assistant"]
    content: str


@dataclass
class Completion:
    text: str
    model: str
    input_tokens: int = 0
    output_tokens: int = 0
    latency_ms: float = 0.0
    refused: bool = False


class ProviderError(Exception):
    pass


class LLMProvider(Protocol):
    name: str

    def complete(
        self, system: str, messages: list[Message], schema: dict[str, Any]
    ) -> Completion: ...


class AnthropicProvider:
    def __init__(
        self,
        model: str = "claude-haiku-5-5",
        effort: Effort = "low",
        api_key: str | None = None,
        max_tokens: int = 2000,
        http_client: httpx2.Client | None = None,
    ) -> None:
        self.name = f"anthropic:{model}"
        self.model = model
        self.effort = effort
        self.max_tokens = max_tokens
        kwargs: dict[str, Any] = {}
        if api_key:
            kwargs["api_key"] = api_key
        if http_client:
            kwargs["http_client"] = http_client
        self.client = anthropic.Anthropic(**kwargs)

    def complete(self, system: str, messages: list[Message], schema: dict[str, Any]) -> Completion:
        output_config: OutputConfigParam = {
            "effort": self.effort,
            "format": {"type": "json_schema", "schema": schema},
        }
        start = time.perf_counter()
        try:
            resp = self.client.messages.create(
                model=self.model,
                max_tokens=self.max_tokens,
                system=system,
                messages=cast(list[MessageParam], messages),
                output_config=output_config,
            )
        except anthropic.APIError as e:
            raise ProviderError(f"{self.name}: {e}") from e
        latency = (time.perf_counter() - start) * 1000

        text = next((b.text for b in resp.content if b.type == "text"), "")
        return Completion(
            text=text,
            model=resp.model,
            input_tokens=resp.usage.input_tokens,
            output_tokens=resp.usage.output_tokens,
            latency_ms=latency,
            refused=resp.stop_reason == "refusal",
        )


class OllamaProvider:
    def __init__(
        self,
        model: str = "llama3.1:8b",
        base_url: str = "http://localhost:11434",
        timeout: float = 180.0,
        transport: httpx.BaseTransport | None = None,
    ) -> None:
        self.name = f"ollama:{model}"
        self.model = model
        self.http = httpx.Client(base_url=base_url, timeout=timeout, transport=transport)

    def complete(self, system: str, messages: list[Message], schema: dict[str, Any]) -> Completion:
        body = {
            "model": self.model,
            "messages": [{"role": "system", "content": system}, *messages],
            "stream": False,
            "format": schema,
            "options": {"temperature": 0},
        }
        start = time.perf_counter()
        try:
            resp = self.http.post("/api/chat", json=body)
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise ProviderError(f"{self.name}: {e}") from e
        latency = (time.perf_counter() - start) * 1000
        data = resp.json()
        return Completion(
            text=data["message"]["content"],
            model=self.model,
            input_tokens=data.get("prompt_eval_count", 0),
            output_tokens=data.get("eval_count", 0),
            latency_ms=latency,
        )


Script = str | Callable[[str, list[Message]], str]


@dataclass
class FakeProvider:
    """Replays scripted replies in order; the last one repeats once the script runs out."""

    script: list[Script]
    name: str = "fake"
    calls: list[tuple[str, list[Message]]] = field(default_factory=list)

    def complete(self, system: str, messages: list[Message], schema: dict[str, Any]) -> Completion:
        self.calls.append((system, list(messages)))
        step = self.script[min(len(self.calls) - 1, len(self.script) - 1)]
        text = step(system, messages) if callable(step) else step
        return Completion(text=text, model="fake")


def make_provider(settings: Settings) -> LLMProvider:
    if settings.llm_provider == "ollama":
        return OllamaProvider(settings.ollama_model, settings.ollama_url)
    if settings.llm_provider == "fake":
        return FakeProvider(
            [
                '{"action": "ask_question", "message": "What have you tried?", '
                '"extraction_attempt": false}'
            ]
        )
    return AnthropicProvider(
        settings.anthropic_model, settings.anthropic_effort, settings.anthropic_api_key
    )
