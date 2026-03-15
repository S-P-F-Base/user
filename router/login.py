from __future__ import annotations

from urllib.parse import urlencode

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from template_env import templates

from . import db
from .auth_context import (
    DEFAULT_AFTER_LOGIN,
    get_request_auth_payload,
    is_authenticated_payload,
    sanitize_next_path,
)

router = APIRouter()

AUTH_COOKIE_NAME = "auth_token"
COOKIE_NAMES_TO_CLEAR = (AUTH_COOKIE_NAME, "session")

NOTICE_MAP: dict[str, str] = {
    "logged_out": "Вы вышли из аккаунта.",
}

ERROR_MAP: dict[str, str] = {
    "auth_required": "Нужно войти в аккаунт.",
    "discord_missing_code": "Discord не вернул код авторизации.",
    "discord_token_exchange_failed": "Не удалось получить токен Discord. Попробуйте снова.",
    "discord_profile_failed": "Не удалось получить профиль Discord.",
    "discord_user_id_missing": "Discord не вернул ID пользователя.",
    "discord_guild_join_failed": "Не удалось зайти на Discord-сервер. Авторизация отклонена.",
    "discord_internal_error": "Ошибка Discord-авторизации.",
    "discord_http_error": "Сетевая ошибка при Discord-авторизации.",
    "discord_unexpected_error": "Неожиданная ошибка при Discord-авторизации.",
    "steam_verification_failed": "Не удалось подтвердить вход через Steam.",
    "steam_internal_error": "Ошибка Steam-авторизации.",
    "steam_http_error": "Сетевая ошибка при Steam-авторизации.",
    "steam_unexpected_error": "Неожиданная ошибка при Steam-авторизации.",
}


def map_notice(code: str | None) -> str | None:
    if not code:
        return None

    return NOTICE_MAP.get(code)


def map_error(code: str | None) -> str | None:
    if not code:
        return None

    return ERROR_MAP.get(code, code)


def build_login_url(next_path: str) -> str:
    query = urlencode(
        {
            "next": next_path,
            "error_next": "/user/login",
        }
    )
    return f"/auth/discord/login?{query}"


@router.get("/user/login", response_class=HTMLResponse)
async def login_page(
    request: Request,
    error: str | None = None,
    notice: str | None = None,
    next: str | None = None,
):
    next_path = sanitize_next_path(next, fallback=DEFAULT_AFTER_LOGIN)
    payload = get_request_auth_payload(request)
    if not error and not notice and is_authenticated_payload(payload):
        return RedirectResponse(url=next_path, status_code=303)

    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "error": map_error(error),
            "notice": map_notice(notice),
            "login_url": build_login_url(next_path),
        },
    )


@router.api_route("/user/logout", methods=["GET", "POST"])
async def logout(request: Request) -> RedirectResponse:
    token = (request.cookies.get(AUTH_COOKIE_NAME) or "").strip()
    if not token:
        auth_header = (request.headers.get("Authorization") or "").strip()
        if auth_header.lower().startswith("bearer "):
            token = auth_header[7:].strip()

    if token:
        db.revoke_auth_token(token)

    response = RedirectResponse(
        url="/user/login?notice=logged_out",
        status_code=303,
    )
    for cookie_name in COOKIE_NAMES_TO_CLEAR:
        response.delete_cookie(cookie_name, path="/")

    return response
