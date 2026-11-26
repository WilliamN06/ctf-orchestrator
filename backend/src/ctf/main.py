from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from sqlmodel import Session

from ctf.config import Settings
from ctf.db import init_db, make_engine
from ctf.routes import teams
from ctf.seed import load_specs, seed


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        init_db(app.state.engine)
        specs = load_specs(settings.challenges_dir)
        with Session(app.state.engine) as session:
            seed(session, specs, settings.flag_secret)
        # plaintext flags stay in memory only; the hint guard needs them
        app.state.flags = {spec.slug: spec.flag for spec in specs}
        yield

    app = FastAPI(title="CTF Orchestrator", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)

    @app.get("/api/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    app.include_router(teams.router)
    return app


app = create_app()
