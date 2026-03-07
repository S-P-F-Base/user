from typing import Any


def get_dummy_user() -> dict[str, Any]:
    return {
        "username": "XXX",
        "avatar": "https://placehold.co/128x128",
        "steam_id": "XXX",
        "discord_id": "XXX",
        "is_admin": False,
    }
