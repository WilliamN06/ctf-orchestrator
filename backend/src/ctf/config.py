from pathlib import Path

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
