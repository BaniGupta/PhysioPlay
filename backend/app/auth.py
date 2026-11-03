"""Very small PIN-based login. Fine for a college project / demo, not for a hospital."""
import hashlib
import secrets

from fastapi import Depends, Header, HTTPException

from .db import get_db, row

SALT = b"physioplay"


def fail(status: int, code: str, message: str):
    """Errors carry a code so the website can show them in the user's language."""
    raise HTTPException(status, {"code": code, "message": message})


def hash_pin(pin: str) -> str:
    return hashlib.pbkdf2_hmac("sha256", pin.encode(), SALT, 100_000).hex()


def new_token(user_id: int) -> str:
    token = secrets.token_urlsafe(24)
    with get_db() as db:
        db.execute("INSERT INTO tokens (token, user_id) VALUES (?, ?)", (token, user_id))
    return token


def current_user(authorization: str = Header(default="")):
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        fail(401, "auth_required", "Log in to continue.")
    with get_db() as db:
        user = row(db.execute(
            "SELECT u.id, u.name, u.role, u.language FROM tokens t JOIN users u ON u.id = t.user_id WHERE t.token = ?",
            (token,)))
    if not user:
        fail(401, "auth_expired", "Your login has expired. Log in again.")
    return user


def patient_user(user=Depends(current_user)):
    if user["role"] != "patient":
        fail(403, "role_patient", "This page is for patients.")
    return user
