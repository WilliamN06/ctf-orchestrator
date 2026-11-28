from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="CTF_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./ctf.db"
    flag_secret: str = "dev-flag-secret-change-me"
    admin_secret: str = "dev-admin-secret-change-me"
    challenges_dir: Path = REPO_ROOT / "challenges"

    submit_limit: int = 10
    submit_window_seconds: int = 60

    llm_provider: Literal["anthropic", "ollama", "fake"] = "anthropic"
    anthropic_api_key: str | None = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    anthropic_model: str = "claude-haiku-5-5"
    anthropic_effort: Literal["low", "medium", "high", "xhigh", "max"] = "low"
    ollama_model: str = "llama3.1:8b"
    ollama_url: str = "http://localhost:11434"
