from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from template_env import templates

from .base import get_dummy_user

router = APIRouter()


def get_dummy_traits() -> dict[str, Any]:
    return {
        "buff_mech": [
            {
                "uid": 1,
                "name": "Устойчивость к боли",
                "description": "Персонаж легче переносит физические повреждения.",
                "cost": 1,
                "is_bio": "true",
            }
        ],
        "buff_rp": [
            {
                "uid": 10,
                "name": "Харизматичный",
                "description": "Легче располагает к себе окружающих.",
                "cost": 1,
                "is_bio": "any",
            }
        ],
        "debuff_mech": [
            {
                "uid": 20,
                "name": "Слабое зрение",
                "description": "Ограниченная дальность и чёткость обзора.",
                "cost": 1,
                "is_bio": "true",
            }
        ],
        "debuff_rp": [
            {
                "uid": 30,
                "name": "Подозрительный",
                "description": "С трудом доверяет другим и склонен к паранойе.",
                "cost": 1,
                "is_bio": "any",
            }
        ],
        "skills": [
            {
                "uid": 40,
                "name": "Медицина",
                "description": "Базовые знания полевой медицины.",
                "cost": 1,
                "is_bio": "any",
            }
        ],
        "lore_templates": [
            {
                "uid": 100,
                "name": "AN-94",
                "description": "Оружейная кукла с высокой дисциплиной и сдержанным поведением.",
            }
        ],
    }


@router.get("/user/characters/create", response_class=HTMLResponse)
async def create_character_page(request: Request) -> HTMLResponse:
    data = get_dummy_traits()

    return templates.TemplateResponse(
        "characters_create.html",
        {
            "request": request,
            "active_page": "create_character",
            "user": get_dummy_user(),
            **data,
        },
    )
