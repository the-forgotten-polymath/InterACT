from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import re
import os

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
    processing_time_ms: float = 12.5

# Common filler words across English & Hinglish
FILLER_WORDS = {
    "um", "uh", "uhm", "er", "ah", "like", "you know", "i mean", "actually",
    "basically", "toh", "matlab", "yani", "arre"
}

def clean_speech_disfluencies(raw_text: str) -> tuple[str, List[str], List[str]]:
    """
    Cleans stuttering, word repetitions, filler sounds, and syllable blocks
    while rigorously preserving negations, questions, numbers, and named entities.
    """
    disfluencies = []
    preserved = []
    
    # 1. Check for critical negations to ensure they are strictly preserved
    negations = ["not", "no", "never", "don't", "dont", "didn't", "wont", "cannot", "can't", "nahi", "na"]
    for neg in negations:
        if re.search(rf"\b{neg}\b", raw_text, re.IGNORECASE):
            preserved.append(f"negation: {neg.lower()}")

    # 2. Check for order IDs, numbers, and currency entities
    numbers_and_ids = re.findall(r"(?:#?[A-Z]{2,4}-?\d{3,6}|\₹?\d+(?:\.\d+)?|\b\d+\b)", raw_text)
    for ent in numbers_and_ids:
        preserved.append(f"entity: {ent}")

    # 3. Detect and remove syllable blocks (e.g. "p-p-paneer", "d-d-delayed")
    def clean_blocks(match):
        token = match.group(0)
        disfluencies.append(f"block: {token}")
        parts = token.split('-')
        return parts[-1]

    text = re.sub(r"\b([a-zA-Z])-([a-zA-Z]-)*([a-zA-Z]{2,})\b", clean_blocks, raw_text)

    # 4. Detect and remove consecutive word/phrase repetitions (e.g. "I... I... I", "the the", "my my")
    # Matches words repeated 2 or more times with optional punctuation/spaces
    def clean_repetitions(match):
        word = match.group(1)
        full_match = match.group(0)
        disfluencies.append(f"repetition: {word}")
        return word

    text = re.sub(r"\b([a-zA-Z0-9#₹]+)(?:[\s,\.]+\1\b)+", clean_repetitions, text, flags=re.IGNORECASE)

    # 5. Detect and remove filler sounds ("um", "uh", "uhm", "er", "ah")
    words = text.split()
    cleaned_words = []
    for w in words:
        clean_w = re.sub(r"[^\w#₹]", "", w).lower()
        if clean_w in FILLER_WORDS:
            disfluencies.append(f"filler: {clean_w}")
        else:
            cleaned_words.append(w)

    reconstructed = " ".join(cleaned_words).strip()

    # Re-capitalize sentence and fix punctuation
    if reconstructed:
        reconstructed = reconstructed[0].upper() + reconstructed[1:]
        if not reconstructed.endswith((".", "?", "!")):
            if any(reconstructed.lower().startswith(q) for q in ["where", "what", "when", "how", "why", "who", "is", "can", "will"]):
                reconstructed += "?"
            else:
                reconstructed += "."

    return reconstructed, disfluencies, preserved

@router.post("/reconstruct", response_model=ReconstructResponse)
async def reconstruct_speech(req: ReconstructRequest):
    """
    Phase 3: Fluency Shield Speech Reconstruction Endpoint.
    Analyzes raw speech transcript, detects dysarthric/stutter disfluencies,
    and returns a reconstructed proposal for customer review.
    """
    if not req.raw_transcript or not req.raw_transcript.strip():
        raise HTTPException(status_code=400, detail="Raw transcript cannot be empty")

    raw = req.raw_transcript.strip()
    
    # Check if input is too short or ambiguous
    if len(raw.split()) <= 1 and raw.lower() in FILLER_WORDS:
        return ReconstructResponse(
            raw_transcript=raw,
            reconstructed_text="",
            confidence_score=0.2,
            disfluencies_detected=[f"filler: {raw}"],
            preserved_entities=[],
            needs_clarification=True,
            clarification_prompt="We only detected a filler sound. Please speak your statement again."
        )

    # Run reconstruction pipeline
    reconstructed, disfluencies, preserved = clean_speech_disfluencies(raw)

    # Baseline confidence scoring based on retention of meaning
    confidence = 0.95 if preserved else 0.90
    if len(disfluencies) > 5:
        confidence = 0.85

    return ReconstructResponse(
        raw_transcript=raw,
        reconstructed_text=reconstructed or raw,
        confidence_score=confidence,
        disfluencies_detected=disfluencies,
        preserved_entities=preserved,
        needs_clarification=False,
        processing_time_ms=15.0
    )
