from datetime import UTC, datetime

from sqlmodel import Field, SQLModel, UniqueConstraint


def utcnow() -> datetime:
    return datetime.now(UTC)


def as_utc(dt: datetime) -> datetime:
    # SQLite hands datetimes back without tzinfo
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


class Team(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True, max_length=40)
    country: str = Field(default="", max_length=8)
    token_hash: str = Field(unique=True, index=True)
    created_at: datetime = Field(default_factory=utcnow)


class Challenge(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    slug: str = Field(unique=True, index=True)
    name: str
    category: str
    difficulty: str
    points: int
    description: str
    flag_hash: str


class Hint(SQLModel, table=True):
    __table_args__ = (UniqueConstraint("challenge_id", "position"),)

    id: int | None = Field(default=None, primary_key=True)
    challenge_id: int = Field(foreign_key="challenge.id", index=True)
    position: int
    text: str


class Attempt(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    challenge_id: int = Field(foreign_key="challenge.id", index=True)
    correct: bool
    created_at: datetime = Field(default_factory=utcnow, index=True)


class Solve(SQLModel, table=True):
    team_id: int = Field(foreign_key="team.id", primary_key=True)
    challenge_id: int = Field(foreign_key="challenge.id", primary_key=True)
    solved_at: datetime = Field(default_factory=utcnow)
    first_blood: bool = False


class ChallengeView(SQLModel, table=True):
    team_id: int = Field(foreign_key="team.id", primary_key=True)
    challenge_id: int = Field(foreign_key="challenge.id", primary_key=True)
    first_seen_at: datetime = Field(default_factory=utcnow)


class HintUnlock(SQLModel, table=True):
    team_id: int = Field(foreign_key="team.id", primary_key=True)
    challenge_id: int = Field(foreign_key="challenge.id", primary_key=True)
    position: int = Field(primary_key=True)
    unlocked_at: datetime = Field(default_factory=utcnow)


class ChatMessage(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    team_id: int = Field(foreign_key="team.id", index=True)
    challenge_id: int = Field(foreign_key="challenge.id", index=True)
    role: str
    content: str
    action: str | None = None
    guard_blocked: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class Competition(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)
    is_open: bool = True
