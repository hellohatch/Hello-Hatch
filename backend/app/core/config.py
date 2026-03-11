from dataclasses import dataclass
from functools import lru_cache
import os


def _get_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _get_int(name: str, default: int) -> int:
    value = os.getenv(name)
    if value is None:
        return default
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"Environment variable {name} must be an integer.") from exc


def _parse_key_map(raw: str | None) -> dict[str, str]:
    if not raw:
        return {}
    parsed: dict[str, str] = {}
    for pair in raw.split(","):
        item = pair.strip()
        if not item:
            continue
        if ":" not in item:
            raise ValueError(
                "THIRD_PARTY_API_KEYS entries must use 'service:key' format."
            )
        service, key = item.split(":", maxsplit=1)
        parsed[service.strip()] = key.strip()
    return parsed


@dataclass(frozen=True)
class JWTSettings:
    secret_key: str
    algorithm: str
    access_token_ttl_minutes: int

    @classmethod
    def from_env(cls) -> "JWTSettings":
        return cls(
            secret_key=os.getenv("JWT_SECRET_KEY", os.getenv("LSI_JWT_SECRET", "dev-secret-change")),
            algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
            access_token_ttl_minutes=_get_int(
                "JWT_ACCESS_TOKEN_TTL_MINUTES",
                _get_int("LSI_TOKEN_TTL_MINUTES", 480),
            ),
        )


@dataclass(frozen=True)
class DatabaseSettings:
    url: str
    pool_size: int
    max_overflow: int
    connect_timeout_seconds: int

    @classmethod
    def from_env(cls) -> "DatabaseSettings":
        return cls(
            url=os.getenv("DATABASE_URL", "sqlite:///database/assessments.db"),
            pool_size=_get_int("DATABASE_POOL_SIZE", 5),
            max_overflow=_get_int("DATABASE_MAX_OVERFLOW", 10),
            connect_timeout_seconds=_get_int("DATABASE_CONNECT_TIMEOUT_SECONDS", 30),
        )


@dataclass(frozen=True)
class APIKeySettings:
    openai_api_key: str | None
    anthropic_api_key: str | None
    internal_api_key: str | None
    third_party_api_keys: dict[str, str]

    @classmethod
    def from_env(cls) -> "APIKeySettings":
        return cls(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            anthropic_api_key=os.getenv("ANTHROPIC_API_KEY"),
            internal_api_key=os.getenv("INTERNAL_API_KEY"),
            third_party_api_keys=_parse_key_map(os.getenv("THIRD_PARTY_API_KEYS")),
        )


@dataclass(frozen=True)
class Settings:
    environment: str
    debug: bool
    jwt: JWTSettings
    database: DatabaseSettings
    api_keys: APIKeySettings

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    def validate(self) -> None:
        if self.is_production and self.jwt.secret_key in {"", "dev-secret-change"}:
            raise ValueError(
                "JWT secret must be configured in production "
                "(set JWT_SECRET_KEY or LSI_JWT_SECRET)."
            )

    @classmethod
    def from_env(cls) -> "Settings":
        settings = cls(
            environment=os.getenv("APP_ENV", "development"),
            debug=_get_bool("DEBUG", default=False),
            jwt=JWTSettings.from_env(),
            database=DatabaseSettings.from_env(),
            api_keys=APIKeySettings.from_env(),
        )
        settings.validate()
        return settings


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings.from_env()
