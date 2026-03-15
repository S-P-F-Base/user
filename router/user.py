from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse

from template_env import templates

from . import db
from .auth_context import require_auth

router = APIRouter()

BLACKLIST_INFO: dict[str, dict[str, str]] = {
    "char_create_locked": {
        "title": "Создание персонажей ограничено",
        "description": "На аккаунте временно запрещено создание новых персонажей.",
    },
}


def format_weight(value: int) -> str:
    if value <= 0:
        return "0 Б"

    units = ["Б", "КБ", "МБ", "ГБ", "ТБ"]
    size = float(value)
    unit_index = 0

    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1

    if unit_index == 0:
        return f"{int(size)} {units[unit_index]}"

    return f"{size:.1f} {units[unit_index]}"


def map_blacklist(key: str) -> dict[str, str]:
    item = BLACKLIST_INFO.get(key)
    if item is not None:
        return {
            "key": key,
            "title": item["title"],
            "description": item["description"],
        }

    return {
        "key": key,
        "title": key,
        "description": "Описание для этого ограничения пока не задано.",
    }


def build_user_page_data() -> dict[str, Any]:
    state = db.load_user_page_state()
    blacklist_keys = state["blacklist_keys"]
    blacklists = [map_blacklist(key) for key in dict.fromkeys(blacklist_keys)]

    char_slot_left = int(state["char_slot_left"])
    lore_char_slot_left = int(state["lore_char_slot_left"])
    weight_left_bytes = int(state["weight_left_bytes"])

    warnings = list(state["warnings"])

    summary = {
        "char_slot_left": char_slot_left,
        "lore_char_slot_left": lore_char_slot_left,
        "weight_left_pretty": format_weight(weight_left_bytes),
    }

    return {
        "user": db.load_current_user(),
        "summary": summary,
        "blacklists": blacklists,
        "warnings": warnings,
        "has_issues": bool(blacklists or warnings),
    }


@router.get("/user", response_class=HTMLResponse)
async def user_page(request: Request) -> Response:
    auth_redirect = require_auth(request)
    if auth_redirect is not None:
        return auth_redirect

    page_data = build_user_page_data()

    return templates.TemplateResponse(
        "user.html",
        {
            "request": request,
            "active_page": "profile",
            **page_data,
        },
    )
