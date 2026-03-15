from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse

from template_env import templates

from .base import get_dummy_user

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


def iso_utc(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


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


def get_dummy_limits_raw(now_utc: datetime) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    next_uid = 10_001

    def add_item(
        *,
        title: str,
        description: str,
        weight_bytes_add: int,
        char_slots_add: int,
        lore_slots_add: int,
        expires_delta: timedelta | None,
        status: str | None = None,
    ) -> None:
        nonlocal next_uid

        expires_at_utc = None
        if expires_delta is not None:
            expires_at_utc = iso_utc(now_utc + expires_delta)

        items.append(
            {
                "uid": next_uid,
                "title": title,
                "description": description,
                "weight_bytes_add": weight_bytes_add,
                "char_slots_add": char_slots_add,
                "lore_slots_add": lore_slots_add,
                "expires_at_utc": expires_at_utc,
                "status": status,
            }
        )
        next_uid += 1

    add_item(
        title="Базовый лимит аккаунта",
        description="Постоянный базовый пакет лимитов аккаунта. Используется как стартовая основа для расчета доступного веса, обычных и лорных слотов, а также как контрольный пример длинного текста для проверки раскрываемого описания в интерфейсе.",
        weight_bytes_add=1_610_612_736,
        char_slots_add=3,
        lore_slots_add=1,
        expires_delta=None,
    )
    add_item(
        title="Истекший ивентовый вес",
        description="Старый ивентовый бонус веса. Оставлен для проверки фильтра истекших.",
        weight_bytes_add=268_435_456,
        char_slots_add=0,
        lore_slots_add=0,
        expires_delta=timedelta(days=-4, hours=-2),
    )
    add_item(
        title="Штраф за перевес",
        description="Временное снижение доступного веса после превышения лимита контента.",
        weight_bytes_add=-134_217_728,
        char_slots_add=0,
        lore_slots_add=0,
        expires_delta=timedelta(days=2, hours=8),
    )
    add_item(
        title="Подарочный слот персонажа",
        description="Единичный бонусный слот за вклад в развитие проекта.",
        weight_bytes_add=0,
        char_slots_add=1,
        lore_slots_add=0,
        expires_delta=None,
    )
    add_item(
        title="Временная блокировка лорных",
        description="Ограничение на лорные слоты до ручной проверки апелляции.",
        weight_bytes_add=0,
        char_slots_add=0,
        lore_slots_add=-1,
        expires_delta=timedelta(hours=18),
    )

    add_item(
        title="Отзыв бонуса администратором",
        description="Администратор отозвал бонусный пакет после проверки.",
        weight_bytes_add=-268_435_456,
        char_slots_add=-1,
        lore_slots_add=0,
        expires_delta=timedelta(days=12),
        status="revoked",
    )
    add_item(
        title="Отмена услуги игроком",
        description="Игрок отменил услугу до окончания срока действия.",
        weight_bytes_add=0,
        char_slots_add=-1,
        lore_slots_add=0,
        expires_delta=timedelta(days=20),
        status="canceled",
    )

    for days in [3, 6, 9, 12, 15, 18, 24, 30, 45, 60, 75, 90]:
        add_item(
            title="Покупка: Пакет веса",
            description="Покупка в магазине: +512 МБ веса и +1 обычный слот.",
            weight_bytes_add=536_870_912,
            char_slots_add=1,
            lore_slots_add=0,
            expires_delta=timedelta(days=days, hours=4),
        )

    for days in [4, 11, 22, 40]:
        add_item(
            title="Покупка: Лорный пропуск",
            description="Покупка в магазине: +1 лорный слот без изменения веса.",
            weight_bytes_add=0,
            char_slots_add=0,
            lore_slots_add=1,
            expires_delta=timedelta(days=days, hours=2),
        )

    for days in [1, 7, 14]:
        add_item(
            title="Покупка: Пакет веса",
            description="Покупка в магазине: +512 МБ веса и +1 обычный слот.",
            weight_bytes_add=536_870_912,
            char_slots_add=1,
            lore_slots_add=0,
            expires_delta=timedelta(days=-days, hours=-3),
        )

    return items


def build_limits_page_data(now_utc: datetime) -> dict[str, Any]:
    raw_items = get_dummy_limits_raw(now_utc)

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
                "weight_bytes_add": int(item["weight_bytes_add"]),
                "char_slots_add": int(item["char_slots_add"]),
                "lore_slots_add": int(item["lore_slots_add"]),
                "effects": build_effects(item),
                "expires_at_utc": item.get("expires_at_utc"),
                "status": status,
                "status_label": STATUS_LABELS.get(status, status),
                "weight_pretty": format_signed_weight(int(item["weight_bytes_add"])),
                "char_slots_pretty": format_signed_int(int(item["char_slots_add"])),
                "lore_slots_pretty": format_signed_int(int(item["lore_slots_add"])),
                "expires_ts": expires_ts,
                "search_blob": search_blob,
            }
        )

    return {
        "user": get_dummy_user(),
        "limits": items,
        "summary": status_counts,
    }


@router.get("/user/limits", response_class=HTMLResponse)
async def limits_page(request: Request) -> HTMLResponse:
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
