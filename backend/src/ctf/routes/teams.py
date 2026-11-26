from fastapi import APIRouter, HTTPException, status
from sqlalchemy.exc import IntegrityError

from ctf.deps import SessionDep, TeamDep
from ctf.models import Team
from ctf.schemas import TeamCreate, TeamCreated, TeamPublic
from ctf.security import hash_token, new_token

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.post("", status_code=status.HTTP_201_CREATED)
def register(body: TeamCreate, session: SessionDep) -> TeamCreated:
    token = new_token()
    team = Team(name=body.name.strip(), country=body.country, token_hash=hash_token(token))
    session.add(team)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Team name already taken") from None
    session.refresh(team)
    assert team.id is not None
    # the token is only ever returned here; we keep a hash
    return TeamCreated(id=team.id, name=team.name, token=token)


@router.get("/me")
def me(team: TeamDep) -> TeamPublic:
    assert team.id is not None
    return TeamPublic(id=team.id, name=team.name, country=team.country)
