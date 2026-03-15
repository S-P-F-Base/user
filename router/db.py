from __future__ import annotations

from datetime import datetime
from typing import Any

NOT_SET_TEXT = "Не установлено"


def _text_or_not_set(value: Any) -> str:
    text = str(value or "").strip()
    if text:
        return text

    return NOT_SET_TEXT


def normalize_user(raw_user: dict[str, Any]) -> dict[str, Any]:
    return {
        "username": _text_or_not_set(raw_user.get("username")),
        "avatar": str(raw_user.get("avatar") or "").strip(),
        "steam_id": _text_or_not_set(raw_user.get("steam_id")),
        "discord_id": _text_or_not_set(raw_user.get("discord_id")),
        "is_admin": bool(raw_user.get("is_admin", False)),
    }


def load_current_user() -> dict[str, Any]:
    # Stub: replace with current user loading from DB/auth context.
    raw_user = {
        "username": "",
        "avatar": "",
        "steam_id": "",
        "discord_id": "",
        "is_admin": False,
    }
    return normalize_user(raw_user)


def load_user_page_state() -> dict[str, Any]:
    # Stub: replace with profile page data loading from DB.
    return {
        "blacklist_keys": [],
        "char_slot_left": 0,
        "lore_char_slot_left": 0,
        "weight_left_bytes": 0,
        "warnings": [],
    }


def load_user_characters() -> list[dict[str, Any]]:
    # Stub: replace with character list loading from DB.
    return []


def load_user_limits(now_utc: datetime) -> list[dict[str, Any]]:
    _ = now_utc
    # Stub: replace with limits/services loading from DB.
    return []


def load_trait_registry() -> list[dict[str, Any]]:
    # Stub: replace with trait registry loading from DB.
    return []


def load_lore_templates() -> list[dict[str, Any]]:
    # Stub: replace with lore templates loading from DB.
    return []


def send_character_create(payload: dict[str, Any]) -> tuple[bool, str]:
    _ = payload
    # Stub: replace with backend call / DB write.
    return True, "created"


def send_lore_character_create(lore_template_id: str) -> tuple[bool, str]:
    _ = lore_template_id
    # Stub: replace with backend call / DB write.
    return True, "lore_requested"


def send_lore_slot_request(reason: str) -> tuple[bool, str]:
    _ = reason
    # Stub: replace with backend call / DB write.
    return True, "lore_slot_sent"


def revoke_auth_token(token: str) -> None:
    _ = token
    # Stub: replace with token revoke in DB.
