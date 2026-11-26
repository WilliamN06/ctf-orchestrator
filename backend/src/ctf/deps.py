from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request, status
from sqlmodel import Session, col, select

from ctf.config import Settings
from ctf.db import get_session
from ctf.models import Team
from ctf.security import hash_token

SessionDep = Annotated[Session, Depends(get_session)]


def get_settings(request: Request) -> Settings:
    settings: Settings = request.app.state.settings
    return settings


SettingsDep = Annotated[Settings, Depends(get_settings)]


def _bearer(authorization: str | None) -> str | None:
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    return authorization[7:].strip() or None


def current_team(
    session: SessionDep, authorization: Annotated[str | None, Header()] = None
) -> Team:
    token = _bearer(authorization)
    team = None
    if token:
        team = session.exec(select(Team).where(col(Team.token_hash) == hash_token(token))).first()
    if team is None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Missing or invalid team token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return team


TeamDep = Annotated[Team, Depends(current_team)]
