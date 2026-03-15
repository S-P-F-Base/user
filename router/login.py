from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from template_env import templates

router = APIRouter()

AUTH_COOKIE_NAME = "auth_token"
COOKIE_NAMES_TO_CLEAR = (AUTH_COOKIE_NAME, "session")

NOTICE_MAP: dict[str, str] = {
    "logged_out": "Вы вышли из аккаунта.",
}


def map_notice(code: str | None) -> str | None:
    if not code:
        return None

    return NOTICE_MAP.get(code)


def extract_request_token(request: Request) -> str:
    cookie_token = (request.cookies.get(AUTH_COOKIE_NAME) or "").strip()
    if cookie_token:
        return cookie_token

    auth_header = (request.headers.get("Authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip()

    return ""


def revoke_auth_token(token: str) -> None:
    # TODO: revoke token in DB (or mark as inactive) so it cannot be reused.
    _ = token


@router.get("/user/login", response_class=HTMLResponse)
async def login_page(
    request: Request,
    error: str | None = None,
    notice: str | None = None,
) -> HTMLResponse:
    return templates.TemplateResponse(
        "login.html",
        {
            "request": request,
            "error": error,
            "notice": map_notice(notice),
        },
    )


@router.api_route("/user/logout", methods=["GET", "POST"])
async def logout(request: Request) -> RedirectResponse:
    token = extract_request_token(request)
    if token:
        revoke_auth_token(token)

    response = RedirectResponse(
        url="/user/login?notice=logged_out",
        status_code=303,
    )
    for cookie_name in COOKIE_NAMES_TO_CLEAR:
        response.delete_cookie(cookie_name, path="/")

    return response
