import contextlib
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from router.characters import router as characters_router
from router.characters_create import router as characters_create_router
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

app.include_router(overlord_api_router)
app.include_router(user_router)
app.include_router(characters_router)
app.include_router(characters_create_router)
app.include_router(login_router)
