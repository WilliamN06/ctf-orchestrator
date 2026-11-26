from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlmodel import Session

from ctf.config import Settings
from ctf.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(database_url="sqlite://", flag_secret="test-secret", admin_secret="admin")


@pytest.fixture
def app(settings: Settings) -> FastAPI:
    return create_app(settings)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def session(client: TestClient, app: FastAPI) -> Iterator[Session]:
    with Session(app.state.engine) as s:
        yield s
