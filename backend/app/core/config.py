from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    app_name: str = "ThinkHub API"
    app_env: str = "development"
    api_v1_prefix: str = "/api"
    frontend_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    data_dir: str = "./data"
    max_upload_mb: int = 20
    chunk_size: int = 900
    chunk_overlap: int = 140
    top_k: int = 5
    min_relevance_score: float = 0.18
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    llm_api_key: str = ""
    llm_base_url: str = ""
    llm_model: str = ""
    llm_temperature: float = 0.2

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def origins(self) -> list[str]:
        return [x.strip() for x in self.frontend_origins.split(",") if x.strip()]

    @property
    def root_data(self) -> Path:
        path = Path(self.data_dir).resolve()
        path.mkdir(parents=True, exist_ok=True)
        return path

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
