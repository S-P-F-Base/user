from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import httpx
from config import DBS_SERVICE_ID, DBS_SOCKET, DBS_TIMEOUT, OVERLORD_SOCKET
from .auth_context import get_current_auth_payload

log = logging.getLogger(__name__)

NOT_SET_TEXT = "Не установлено"


class DBServiceClient:
    service_id: str = DBS_SERVICE_ID
    dbs_socket: Path = DBS_SOCKET
    overlord_socket: Path = OVERLORD_SOCKET
    timeout: float = DBS_TIMEOUT

    @classmethod
    def configure(
        cls,
        *,
        service_id: str | None = None,
        dbs_socket: str | Path | None = None,
        overlord_socket: str | Path | None = None,
        timeout: float | None = None,
    ) -> None:
        if service_id is not None:
            cls.service_id = service_id

        if dbs_socket is not None:
            cls.dbs_socket = Path(str(dbs_socket))

        if overlord_socket is not None:
            cls.overlord_socket = Path(str(overlord_socket))

        if timeout is not None:
            cls.timeout = timeout

    @classmethod
    def _normalize_path(cls, path: str) -> str:
        cleaned = path.strip()
        if not cleaned.startswith("/"):
            cleaned = "/" + cleaned

        return cleaned

    @classmethod
    def _request_with_socket(
        cls,
        *,
        socket_path: Path,
        method: str,
        url: str,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> httpx.Response:
        transport = httpx.HTTPTransport(uds=str(socket_path))
        with httpx.Client(
            transport=transport,
            timeout=cls.timeout,
        ) as client:
            return client.request(
                method=method,
                url=url,
                params=params,
                json=json,
                data=data,
                headers=headers,
            )

    @classmethod
    def resolve_socket(cls) -> tuple[Path, bool]:
        """Resolve dbs socket from overlord `/svc/{id}` with fallback."""
        try:
            resp = cls._request_with_socket(
                socket_path=cls.overlord_socket,
                method="GET",
                url=f"http://overlord/svc/{cls.service_id}",
            )
            if resp.status_code == 200:
                payload = resp.json()
                sock = str(payload.get("sock") or "").strip()
                if sock:
                    return Path(sock), bool(payload.get("is_usable", False))

        except Exception as exc:
            log.debug(
                "Failed to resolve %s socket via overlord: %s",
                cls.service_id,
                exc,
            )

        return cls.dbs_socket, True

    @classmethod
    def request(
        cls,
        method: str,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        json: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        expected_statuses: tuple[int, ...] = (200,),
        default: Any = None,
        parse_json: bool = True,
        allow_unusable: bool = False,
    ) -> Any:
        socket_path, is_usable = cls.resolve_socket()
        if not is_usable and not allow_unusable:
            log.warning(
                "DB service %s is not usable (socket: %s)",
                cls.service_id,
                socket_path,
            )
            return default

        url = f"http://{cls.service_id}{cls._normalize_path(path)}"

        try:
            resp = cls._request_with_socket(
                socket_path=socket_path,
                method=method.upper(),
                url=url,
                params=params,
                json=json,
                data=data,
                headers=headers,
            )

        except httpx.ConnectError:
            log.warning("DB service socket is not available: %s", socket_path)
            return default

        except httpx.TimeoutException:
            log.warning("DB service request timeout: %s %s", method.upper(), url)
            return default

        except Exception as exc:
            log.exception(
                "Unexpected DB service request error: %s %s (%s)",
                method.upper(),
                url,
                exc,
            )
            return default

        if resp.status_code not in expected_statuses:
            log.warning(
                "DB service returned %s for %s %s",
                resp.status_code,
                method.upper(),
                url,
            )
            return default

        if not parse_json:
            return resp.text

        try:
            return resp.json()

        except ValueError:
            log.warning(
                "DB service returned invalid JSON for %s %s",
                method.upper(),
                url,
            )
            return default

    @classmethod
    def get_json(
        cls,
        path: str,
        *,
        params: dict[str, Any] | None = None,
        expected_statuses: tuple[int, ...] = (200,),
        default: Any = None,
    ) -> Any:
        return cls.request(
            "GET",
            path,
            params=params,
            expected_statuses=expected_statuses,
            default=default,
            parse_json=True,
        )

    @classmethod
    def post_json(
        cls,
        path: str,
        *,
        payload: dict[str, Any] | None = None,
        expected_statuses: tuple[int, ...] = (200,),
        default: Any = None,
    ) -> Any:
        return cls.request(
            "POST",
            path,
            json=payload,
            expected_statuses=expected_statuses,
            default=default,
            parse_json=True,
        )


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
    payload = get_current_auth_payload()
    username = (
        str(payload.get("discord_username") or "").strip()
        or str(payload.get("steam_persona") or "").strip()
    )
    avatar = (
        str(payload.get("avatar_url") or "").strip()
        or str(payload.get("steam_avatar_url") or "").strip()
    )
    steam_id = str(payload.get("steam_id") or "").strip()
    discord_id = str(payload.get("discord_id") or "").strip()

    # Temporary source of user identity: auth cookie payload.
    raw_user = {
        "username": username,
        "avatar": avatar,
        "steam_id": steam_id,
        "discord_id": discord_id,
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
