import hashlib
import hmac
import secrets


def hash_flag(secret: str, flag: str) -> str:
    return hmac.new(secret.encode(), flag.strip().encode(), hashlib.sha256).hexdigest()


def check_flag(secret: str, submitted: str, flag_hash: str) -> bool:
    return hmac.compare_digest(hash_flag(secret, submitted), flag_hash)


def new_token() -> str:
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()
