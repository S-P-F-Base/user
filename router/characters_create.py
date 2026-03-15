from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from template_env import templates

from .base import get_dummy_user

router = APIRouter()

MAX_WORKSHOP_ITEMS = 20

POPUP_MAP: dict[str, dict[str, str]] = {
    "missing_required": {
        "type": "bad",
        "text": "Заполните обязательные поля.",
    },
    "missing_lore_template": {
        "type": "bad",
        "text": "Выберите лорного персонажа из списка.",
    },
    "invalid_workshop_ids": {
        "type": "bad",
        "text": "В форму должны приходить только ID Workshop-контента.",
    },
    "content_overweight": {
        "type": "bad",
        "text": "Перевес дополнительного контента: превышен лимит по Workshop-элементам.",
    },
    "lore_slot_empty_reason": {
        "type": "bad",
        "text": "Укажите причину запроса дополнительного лорного слота.",
    },
    "lore_slot_sent": {
        "type": "good",
        "text": "Запрос на дополнительный лорный слот отправлён.",
    },
    "created": {
        "type": "good",
        "text": "Заявка на персонажа отправлена.",
    },
    "lore_requested": {
        "type": "good",
        "text": "Заявка на лорного персонажа отправлена.",
    },
    "request_failed": {
        "type": "bad",
        "text": "Не удалось отправить запрос. Попробуйте ещё раз.",
    },
}


def get_popup(code: str | None) -> dict[str, str] | None:
    if not code:
        return None

    return POPUP_MAP.get(code)


async def read_urlencoded_form(request: Request) -> dict[str, list[str]]:
    raw_body = (await request.body()).decode("utf-8", errors="ignore")
    parsed = parse_qs(raw_body, keep_blank_values=True)

    return {key: [value.strip() for value in values] for key, values in parsed.items()}


def first_value(form_data: dict[str, list[str]], key: str) -> str:
    values = form_data.get(key)
    if not values:
        return ""

    return values[0].strip()


# --- Integration stubs (replace with real API calls) ---
def load_trait_registry() -> list[dict[str, Any]]:
    return []


def load_lore_templates() -> list[dict[str, Any]]:
    return []


def send_character_create(payload: dict[str, Any]) -> tuple[bool, str]:
    _ = payload
    return True, "created"


def send_lore_character_create(lore_template_id: str) -> tuple[bool, str]:
    _ = lore_template_id
    return True, "lore_requested"


def send_lore_slot_request(reason: str) -> tuple[bool, str]:
    _ = reason
    return True, "lore_slot_sent"


# --- Validation helpers ---
def workshop_weight_ok(model_id: str, extra_ids: set[str]) -> bool:
    workshop_ids = set(extra_ids)
    if model_id:
        workshop_ids.add(model_id)

    return len(workshop_ids) <= MAX_WORKSHOP_ITEMS


@router.get("/user/characters/create", response_class=HTMLResponse)
async def create_character_page(
    request: Request,
    popup: str | None = None,
) -> HTMLResponse:
    return templates.TemplateResponse(
        "characters_create.html",
        {
            "request": request,
            "active_page": "create_character",
            "user": get_dummy_user(),
            "popup": get_popup(popup),
            "traits": load_trait_registry(),
            "lore_templates": load_lore_templates(),
        },
    )


@router.post("/user/characters/create")
async def create_character(request: Request) -> RedirectResponse:
    form_data = await read_urlencoded_form(request)
    role_type = first_value(form_data, "char_role_type")

    if role_type == "lore":
        lore_template_id = first_value(form_data, "lore_template_id")
        if not lore_template_id:
            return RedirectResponse(
                url="/user/characters/create?popup=missing_lore_template",
                status_code=303,
            )

        ok, popup_code = send_lore_character_create(lore_template_id)
        if not ok:
            popup_code = popup_code or "request_failed"

        return RedirectResponse(
            url=f"/user/characters/create?popup={popup_code}",
            status_code=303,
        )

    required_fields = ("name", "body_type", "description", "backstory")
    if any(not first_value(form_data, field) for field in required_fields):
        return RedirectResponse(
            url="/user/characters/create?popup=missing_required",
            status_code=303,
        )

    model_id = first_value(form_data, "model_id")
    if model_id and not model_id.isdigit():
        return RedirectResponse(
            url="/user/characters/create?popup=invalid_workshop_ids",
            status_code=303,
        )

    extra_ids = {value for value in form_data.get("extra_content", []) if value}

    if any(not value.isdigit() for value in extra_ids):
        return RedirectResponse(
            url="/user/characters/create?popup=invalid_workshop_ids",
            status_code=303,
        )

    if not workshop_weight_ok(model_id, extra_ids):
        return RedirectResponse(
            url="/user/characters/create?popup=content_overweight",
            status_code=303,
        )

    payload = {
        "name": first_value(form_data, "name"),
        "body_type": first_value(form_data, "body_type"),
        "description": first_value(form_data, "description"),
        "backstory": first_value(form_data, "backstory"),
        "model_id": model_id or None,
        "extra_content_ids": sorted(extra_ids, key=int),
    }

    ok, popup_code = send_character_create(payload)
    if not ok:
        popup_code = popup_code or "request_failed"

    return RedirectResponse(
        url=f"/user/characters/create?popup={popup_code}",
        status_code=303,
    )


@router.post("/user/characters/create/request-lore-slot")
async def request_lore_slot(request: Request) -> RedirectResponse:
    form_data = await read_urlencoded_form(request)
    reason = first_value(form_data, "reason")

    if not reason:
        return RedirectResponse(
            url="/user/characters/create?popup=lore_slot_empty_reason",
            status_code=303,
        )

    ok, popup_code = send_lore_slot_request(reason)
    if not ok:
        popup_code = popup_code or "request_failed"

    return RedirectResponse(
        url=f"/user/characters/create?popup={popup_code}",
        status_code=303,
    )
