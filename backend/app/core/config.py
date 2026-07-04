from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    APP_NAME: str = "TaskForge API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_PORT: int = 8000

    # Postgres
    POSTGRES_DB: str = "taskforge"
    POSTGRES_USER: str = "taskforge"
    POSTGRES_PASSWORD: str = "taskforge"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = "postgresql+psycopg://taskforge:taskforge@localhost:5432/taskforge"

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_URL: str = "redis://localhost:6379/0"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()