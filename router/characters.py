from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from template_env import templates

from . import db

router = APIRouter()


def build_workshop_url(content_id: str | int) -> str:
    return f"https://steamcommunity.com/sharedfiles/filedetails/?id={content_id}"


def build_discord_url(discord_path: str | None) -> str | None:
    if not discord_path:
        return None

    discord_path = discord_path.strip().strip("/")
    if not discord_path:
        return None

    return f"https://discord.com/channels/{discord_path}"


def map_char_type(value: str) -> tuple[str, str]:
    if value == "lore":
        return "Лорный", "character-type-lore"

    return "Обычный", "character-type-norm"


def map_character_row(row: dict[str, Any]) -> dict[str, Any]:
    raw_content_ids = row.get("content_ids", [])
    if not isinstance(raw_content_ids, list):
        raw_content_ids = []

    content_items: list[dict[str, str]] = []
    for raw_id in raw_content_ids:
        content_id = str(raw_id)
        content_items.append(
            {
                "id": content_id,
                "url": build_workshop_url(content_id),
                "label": f"#{content_id}",
            }
        )

    type_label, type_class = map_char_type(row["char_type"])

    return {
        "uid": row["uid"],
        "name": row["name"],
        "discord_url": build_discord_url(row.get("discord_url")),
        "char_type": row["char_type"],
        "type_label": type_label,
        "type_class": type_class,
        "content_items": content_items,
        "content_count": len(content_items),
    }


@router.get("/user/characters", response_class=HTMLResponse)
async def user_characters_page(request: Request) -> HTMLResponse:
    rows = db.load_user_characters()
    user = db.load_current_user()
    characters = [map_character_row(row) for row in rows]

    return templates.TemplateResponse(
        "characters.html",
        {
            "request": request,
            "active_page": "characters",
            "user": user,
            "characters": characters,
        },
    )


@router.post("/user/characters/{char_uid}/request-delete")
async def request_character_delete(
    request: Request,
    char_uid: int,
):
    # TODO:
    # 1. проверить, что персонаж принадлежит текущему пользователю
    # 2. создать запись запроса на удаление / пометку в БД
    # 3. показать flash-message или статус

    return RedirectResponse(url="/user/characters", status_code=303)
