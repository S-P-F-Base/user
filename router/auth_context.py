from __future__ import annotations

import base64
import contextvars
import hashlib
import hmac
import json
import os
import time
from typing import Any
from urllib.parse import urlencode, urlsplit

from fastapi import Request
from fastapi.responses import RedirectResponse

AUTH_COOKIE_NAME = "auth_token"
SESSION_COOKIE_NAME = "session"
LOGIN_PATH = "/user/login"
DEFAULT_AFTER_LOGIN = "/user"
LOCAL_AUTH_PAYLOAD: dict[str, str] = {
    "provider": "local",
    "cid": "local-cid",
    "discord_id": "local-discord-id",
    "discord_username": "Local Dev",
    "steam_id": "local-steam-id",
    "steam_persona": "Local Dev",
}

_AUTH_PAYLOAD_CTX: contextvars.ContextVar[dict[str, Any]] = contextvars.ContextVar(
    "auth_payload",
    default={},
)


def is_local_run(request: Request) -> bool:
    return bool(getattr(request.app.state, "is_local_run", False))


def build_dev_auth_payload() -> dict[str, Any]:
    return dict(LOCAL_AUTH_PAYLOAD)


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def _jwt_key() -> str:
    key = os.environ.get("jwt_key", "").strip()
    if key:
        return key

    return ""


def _token_sign(payload_b64: str, key: str) -> str:
    digest = hmac.new(
        key=key.encode("utf-8"),
        msg=payload_b64.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).digest()
    return _b64url_encode(digest)


def decode_auth_token(token: str) -> dict[str, Any] | None:
    key = _jwt_key()
    if not key:
        return None

    token = token.strip()
    if "." not in token:
        return None

    try:
        payload_b64, signature_b64 = token.split(".", 1)
        expected_signature = _token_sign(payload_b64, key)
        if not hmac.compare_digest(signature_b64, expected_signature):
            return None

        payload_raw = _b64url_decode(payload_b64)
        payload = json.loads(payload_raw.decode("utf-8"))
        if not isinstance(payload, dict):
            return None

        exp = int(payload.get("exp", 0))
        if exp and exp < int(time.time()):
            return None

        return payload

    except Exception:
        return None


def extract_request_token(request: Request) -> str:
    token = (request.cookies.get(AUTH_COOKIE_NAME) or "").strip()
    if token:
        return token

    token = (request.cookies.get(SESSION_COOKIE_NAME) or "").strip()
    if token:
        return token

    auth_header = (request.headers.get("Authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()

    return ""


def get_request_auth_payload(request: Request) -> dict[str, Any]:
    payload = getattr(request.state, "auth_payload", None)
    if isinstance(payload, dict):
        return payload

    token = extract_request_token(request)
    payload = decode_auth_token(token) or {}
    if not payload and is_local_run(request):
        payload = build_dev_auth_payload()

    request.state.auth_payload = payload
    return payload


def is_authenticated_payload(payload: dict[str, Any]) -> bool:
    return bool(
        payload.get("discord_id") or payload.get("steam_id") or payload.get("cid")
    )


def sanitize_next_path(path: str | None, *, fallback: str = DEFAULT_AFTER_LOGIN) -> str:
    value = (path or "").strip()
    if not value:
        return fallback

    if not value.startswith("/"):
        return fallback

    if value.startswith("//"):
        return fallback

    parsed = urlsplit(value)
    if parsed.scheme or parsed.netloc:
        return fallback

    return value


def set_current_auth_payload(payload: dict[str, Any]) -> contextvars.Token:
    return _AUTH_PAYLOAD_CTX.set(payload)


def reset_current_auth_payload(token: contextvars.Token) -> None:
    _AUTH_PAYLOAD_CTX.reset(token)


def get_current_auth_payload() -> dict[str, Any]:
    return _AUTH_PAYLOAD_CTX.get({})


def build_auth_required_redirect(next_path: str) -> RedirectResponse:
    safe_next = sanitize_next_path(next_path, fallback=DEFAULT_AFTER_LOGIN)
    query = urlencode({"error": "auth_required", "next": safe_next})
    return RedirectResponse(url=f"{LOGIN_PATH}?{query}", status_code=303)


def require_auth(
    request: Request,
    *,
    next_path: str | None = None,
) -> RedirectResponse | None:
    payload = get_request_auth_payload(request)
    if is_authenticated_payload(payload):
        return None

    target = next_path
    if not target:
        target = request.url.path
        if request.url.query:
            target = f"{target}?{request.url.query}"

    return build_auth_required_redirect(target)
