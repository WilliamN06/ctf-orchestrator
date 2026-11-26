from fastapi import FastAPI
from sqlmodel import Session, select

from ctf.config import Settings
from ctf.models import Challenge, Hint
from ctf.security import check_flag
from ctf.seed import load_specs, seed


def test_all_challenges_seeded(session: Session, settings: Settings) -> None:
    challenges = session.exec(select(Challenge)).all()
    assert len(challenges) == len(load_specs(settings.challenges_dir)) == 8


def test_no_plaintext_flags_in_database(session: Session, settings: Settings) -> None:
    for spec in load_specs(settings.challenges_dir):
        ch = session.exec(select(Challenge).where(Challenge.slug == spec.slug)).one()
        assert spec.flag not in ch.flag_hash
        assert check_flag(settings.flag_secret, spec.flag, ch.flag_hash)
        assert not check_flag(settings.flag_secret, spec.flag + "x", ch.flag_hash)


def test_reseeding_is_idempotent(session: Session, settings: Settings) -> None:
    specs = load_specs(settings.challenges_dir)
    seed(session, specs, settings.flag_secret)
    assert len(session.exec(select(Challenge)).all()) == 8
    assert len(session.exec(select(Hint)).all()) == sum(len(s.hints) for s in specs)


def test_flags_kept_in_memory_for_guard(app: FastAPI, session: Session) -> None:
    assert app.state.flags["jwt-jailbreak"] == "CTF{alg0rithm_c0nfusion}"
