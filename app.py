import contextlib
import os

from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles

from router.auth_context import (
    get_request_auth_payload,
    reset_current_auth_payload,
    set_current_auth_payload,
)
from router.characters import router as characters_router
from router.characters_create import router as characters_create_router
from router.limits import router as limits_router
from router.login import router as login_router
from router.overlord_api import router as overlord_api_router
from router.user import router as user_router


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield

    finally:
        pass


app = FastAPI(
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

if os.getenv("FASTAPISTATIC") == "1":
    app.mount(
        "/static",
        StaticFiles(directory="static"),
        name="static",
    )


@app.middleware("http")
async def auth_context_middleware(request: Request, call_next):
    payload = get_request_auth_payload(request)
    request.state.auth_payload = payload
    ctx_token = set_current_auth_payload(payload)
    try:
        return await call_next(request)
    finally:
        reset_current_auth_payload(ctx_token)


app.include_router(overlord_api_router)
app.include_router(user_router)
app.include_router(limits_router)
app.include_router(characters_router)
app.include_router(characters_create_router)
app.include_router(login_router)
