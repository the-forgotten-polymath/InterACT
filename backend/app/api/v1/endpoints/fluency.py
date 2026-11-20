from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from ....services.fluency_service import fluency_service

router = APIRouter()

class ReconstructRequest(BaseModel):
    raw_transcript: str
    language: Optional[str] = "en"
    session_id: Optional[str] = None

class DisfluencyItem(BaseModel):
    type: str  # 'filler', 'repetition', 'block', 'interruption'
    token: str
    position: Optional[int] = None

class ReconstructResponse(BaseModel):
    raw_transcript: str
    reconstructed_text: str
    confidence_score: float
    disfluencies_detected: List[str]
    preserved_entities: List[str]
    needs_clarification: bool = False
    clarification_prompt: Optional[str] = None
    processing_time_ms: float = 15.0
    engine: Optional[str] = "gemini-2.5-flash"

@router.post("/reconstruct", response_model=ReconstructResponse)
async def reconstruct_speech(req: ReconstructRequest):
    """
    Phase 3: Fluency Shield Speech Reconstruction Endpoint.
    Uses Google Gemini 2.5 Flash API with strict structured JSON schema
    to reconstruct dysarthric/stuttered speech into fluent, grammatically cohesive
    sentences while guaranteeing semantic preservation of negations, numbers, and order entities.
    """
    if not req.raw_transcript or not req.raw_transcript.strip():
        raise HTTPException(status_code=400, detail="Raw transcript cannot be empty")

    result = await fluency_service.reconstruct(
        raw_transcript=req.raw_transcript,
        language=req.language or "en"
    )

    return ReconstructResponse(**result)
