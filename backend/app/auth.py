import httpx
from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .config import settings
from .db import get_db
from .models import User
from .schemas import UserContext

# ── Supabase Auth Verification ────────────────────────────────────────────────
# Supabase uses HS256 symmetric signatures by default, not JWKS/RS256.


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    return authorization.split(" ", 1)[1].strip()


def _verify_token(token: str) -> UserContext:
    provider = settings.auth_provider.lower()

    if provider == "dev":
        # Dev mode: token value IS the user ID. Warned at startup.
        if not token:
            raise HTTPException(status_code=401, detail="Token required even in dev mode")
        return UserContext(id=token, email=f"{token}@dev.ledger.local")

    if provider == "firebase":
        try:
            import firebase_admin
            from firebase_admin import auth as firebase_auth

            if not firebase_admin._apps:
                firebase_admin.initialize_app()
            decoded = firebase_auth.verify_id_token(token)
            return UserContext(id=decoded["uid"], email=decoded.get("email"))
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Firebase auth failed: {e}")

    if provider == "supabase":
        try:
            from jose import jwt

            if not settings.supabase_jwt_secret:
                raise HTTPException(status_code=500, detail="SUPABASE_JWT_SECRET not configured")

            decoded = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            return UserContext(id=decoded["sub"], email=decoded.get("email"))
        except Exception as e:
            raise HTTPException(status_code=401, detail=f"Token invalid: {e}")

    raise HTTPException(status_code=500, detail=f"Unknown AUTH_PROVIDER: {provider}")


def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> UserContext:
    user = _verify_token(_bearer(authorization))
    # Upsert user record
    existing = db.get(User, user.id)
    if not existing:
        db.add(User(id=user.id, email=user.email))
        db.commit()
    return user
