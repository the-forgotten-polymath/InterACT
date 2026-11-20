import os
from typing import List
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

def parse_origins(raw: str) -> List[str]:
    if not raw:
        return ["*"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]

class Settings(BaseModel):
    PROJECT_NAME: str = "InterACT Engine"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Server Host & Port
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # CORS
    ALLOWED_ORIGINS: List[str] = Field(
        default_factory=lambda: parse_origins(
            os.getenv(
                "ALLOWED_ORIGINS",
                "http://localhost:3000,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174"
            )
        )
    )
    
    # Session defaults
    SESSION_CODE_LENGTH: int = 6
    SESSION_EXPIRY_HOURS: int = int(os.getenv("SESSION_EXPIRY_HOURS", "4"))
    
    # Optional Database / Redis URL
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./interact.db")
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    
    # AI Credentials (for Phase 2-5)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()
