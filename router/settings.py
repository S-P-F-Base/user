from __future__ import annotations

from urllib.parse import urlencode

from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse

from template_env import templates

from . import db
from .auth_context import require_auth, sanitize_next_path

router = APIRouter()

STEAM_ERROR_REDIRECT_PATH = "/user/login"


def _has_steam_link(user: dict[str, object]) -> bool:
    steam_id = str(user.get("steam_id") or "").strip()
    return bool(steam_id and steam_id != db.NOT_SET_TEXT)


def build_steam_link_url(next_path: str) -> str:
    safe_next_path = sanitize_next_path(next_path, fallback="/user/settings")
    query = urlencode(
        {
            "next": safe_next_path,
            "error_next": STEAM_ERROR_REDIRECT_PATH,
        }
    )
    return f"/auth/steam/login?{query}"


@router.get("/user/settings", response_class=HTMLResponse)
async def settings_page(request: Request) -> Response:
    auth_redirect = require_auth(request)
    if auth_redirect is not None:
        return auth_redirect

    user = db.load_current_user()
    is_steam_linked = _has_steam_link(user)

    return templates.TemplateResponse(
        "settings.html",
        {
            "request": request,
            "active_page": "settings",
            "user": user,
            "is_steam_linked": is_steam_linked,
            "steam_link_url": build_steam_link_url(request.url.path),
        },
    )
