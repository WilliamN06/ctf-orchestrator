from datetime import datetime

from pydantic import BaseModel, Field


class TeamCreate(BaseModel):
    name: str = Field(min_length=2, max_length=40, pattern=r"^[\w .()\-]+$")
    country: str = Field(default="", max_length=8)


class TeamCreated(BaseModel):
    id: int
    name: str
    token: str


class TeamPublic(BaseModel):
    id: int
    name: str
    country: str


class ChallengeSummary(BaseModel):
    slug: str
    name: str
    category: str
    difficulty: str
    points: int
    description: str
    hint_count: int
    solves: int


class UnlockedHint(BaseModel):
    position: int
    text: str
    unlocked_at: datetime


class ChallengeDetail(ChallengeSummary):
    solved: bool
    unlocked_hints: list[UnlockedHint]


class FlagSubmit(BaseModel):
    flag: str = Field(min_length=1, max_length=200)


class FlagResult(BaseModel):
    correct: bool
    already_solved: bool = False
    first_blood: bool = False
    points: int = 0


class ScoreboardEntry(BaseModel):
    rank: int
    team_id: int
    name: str
    country: str
    score: int
    solves: int
    last_solve: datetime | None


class CompetitionState(BaseModel):
    is_open: bool


class ChallengeStats(BaseModel):
    slug: str
    attempts: int
    wrong_attempts: int
    solves: int
    first_blood_team: str | None
    hint_unlocks: int
    chat_messages: int
    guard_blocks: int


class AdminTeam(TeamPublic):
    created_at: datetime
    score: int
    solves: int
