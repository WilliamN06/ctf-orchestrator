from pathlib import Path

import yaml
from pydantic import BaseModel, Field
from sqlmodel import Session, col, delete, select

from ctf.models import Challenge, Hint
from ctf.security import hash_flag


class ChallengeSpec(BaseModel):
    slug: str
    name: str
    category: str
    difficulty: str
    points: int = Field(gt=0)
    description: str
    flag: str
    hints: list[str] = []


def load_specs(directory: Path) -> list[ChallengeSpec]:
    specs = []
    for path in sorted(directory.glob("*.yaml")):
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        specs.append(ChallengeSpec.model_validate(data))
    return specs


def seed(session: Session, specs: list[ChallengeSpec], flag_secret: str) -> None:
    for spec in specs:
        fields = spec.model_dump(exclude={"slug", "flag", "hints"})
        fields["flag_hash"] = hash_flag(flag_secret, spec.flag)
        challenge = session.exec(select(Challenge).where(col(Challenge.slug) == spec.slug)).first()
        if challenge is None:
            challenge = Challenge(slug=spec.slug, **fields)
        else:
            challenge.sqlmodel_update(fields)
        session.add(challenge)
        session.flush()
        assert challenge.id is not None

        session.execute(delete(Hint).where(col(Hint.challenge_id) == challenge.id))
        for i, text in enumerate(spec.hints, start=1):
            session.add(Hint(challenge_id=challenge.id, position=i, text=text))
    session.commit()
