from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Request, Response
from fastapi.responses import HTMLResponse

from template_env import templates

from . import db
from .auth_context import require_auth

router = APIRouter()

ALLOWED_STATUSES = {"active", "expired", "permanent", "revoked", "canceled"}
STATUS_LABELS = {
    "active": "Активна",
    "expired": "Истекла",
    "permanent": "Бессрочно",
    "revoked": "Отозвана",
    "canceled": "Отменена игроком",
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


def format_signed_weight(value: int) -> str:
    if value == 0:
        return "0 Б"

    sign = "+" if value > 0 else "-"
    return f"{sign}{format_weight(abs(value))}"


def format_signed_int(value: int) -> str:
    if value == 0:
        return "0"

    return f"{value:+d}"


def parse_utc(value: str | None) -> datetime | None:
    if not value:
        return None

    try:
        return datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None


def resolve_status(
    raw_status: str | None,
    *,
    is_permanent_by_time: bool,
    is_expired_by_time: bool,
) -> str:
    status = (raw_status or "").strip().lower()

    if status in {"revoked", "canceled"}:
        return status

    if status == "expired":
        return "expired"

    if status == "permanent":
        return "permanent"

    if status == "active":
        if is_permanent_by_time:
            return "permanent"

        if is_expired_by_time:
            return "expired"

        return "active"

    if is_permanent_by_time:
        return "permanent"

    if is_expired_by_time:
        return "expired"

    return "active"


def build_effects(item: dict[str, Any]) -> list[dict[str, str]]:
    effects: list[dict[str, str]] = []
    fields = [
        ("weight_bytes_add", "Вес", format_signed_weight),
        ("char_slots_add", "Обычные слоты", format_signed_int),
        ("lore_slots_add", "Лорные слоты", format_signed_int),
    ]

    for field_name, label, formatter in fields:
        raw_value = int(item.get(field_name, 0))
        if raw_value == 0:
            continue

        effects.append(
            {
                "label": label,
                "value": formatter(raw_value),
            }
        )

    return effects


def build_limits_page_data(now_utc: datetime) -> dict[str, Any]:
    raw_items = db.load_user_limits(now_utc)

    items: list[dict[str, Any]] = []
    status_counts = {status: 0 for status in ALLOWED_STATUSES}

    for index, item in enumerate(raw_items):
        expires_dt = parse_utc(item.get("expires_at_utc"))
        is_permanent_by_time = expires_dt is None
        is_expired_by_time = expires_dt is not None and expires_dt <= now_utc

        status = resolve_status(
            item.get("status"),
            is_permanent_by_time=is_permanent_by_time,
            is_expired_by_time=is_expired_by_time,
        )

        expires_ts = int(expires_dt.timestamp()) if expires_dt else 0
        status_counts[status] += 1

        search_blob = " ".join(
            [
                str(item.get("title", "")),
                str(item.get("description", "")),
                STATUS_LABELS.get(status, status),
            ]
        ).lower()

        items.append(
            {
                "entry_no": index + 1,
                "order_index": index,
                "title": str(item.get("title", "")),
                "description": str(item.get("description", "")),
                "weight_bytes_add": int(item.get("weight_bytes_add", 0)),
                "char_slots_add": int(item.get("char_slots_add", 0)),
                "lore_slots_add": int(item.get("lore_slots_add", 0)),
                "effects": build_effects(item),
                "expires_at_utc": item.get("expires_at_utc"),
                "status": status,
                "status_label": STATUS_LABELS.get(status, status),
                "weight_pretty": format_signed_weight(
                    int(item.get("weight_bytes_add", 0))
                ),
                "char_slots_pretty": format_signed_int(
                    int(item.get("char_slots_add", 0))
                ),
                "lore_slots_pretty": format_signed_int(
                    int(item.get("lore_slots_add", 0))
                ),
                "expires_ts": expires_ts,
                "search_blob": search_blob,
            }
        )

    return {
        "user": db.load_current_user(),
        "limits": items,
        "summary": status_counts,
    }


@router.get("/user/limits", response_class=HTMLResponse)
async def limits_page(request: Request) -> Response:
    auth_redirect = require_auth(request)
    if auth_redirect is not None:
        return auth_redirect

    now_utc = datetime.now(timezone.utc)
    page_data = build_limits_page_data(now_utc)

    return templates.TemplateResponse(
        "limits.html",
        {
            "request": request,
            "active_page": "limits",
            **page_data,
        },
    )
