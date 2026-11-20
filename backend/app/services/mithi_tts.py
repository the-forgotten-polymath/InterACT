import os
import sys
import json
import time
import hashlib
import logging
from pathlib import Path
from typing import Optional, Dict, Any, List

logger = logging.getLogger("interact.mithi")

MODEL_DIR = Path(__file__).parent.parent.parent / "models" / "mithi-v2-flash"
AUDIO_CACHE_DIR = Path(__file__).parent.parent.parent / "static" / "audio"
AUDIO_CACHE_DIR.mkdir(parents=True, exist_ok=True)

# 10 Mithi Indian Voices
MITHI_VOICES = {
    "female": ["ahana", "charvi", "vaidehi", "malini", "jahnavi"],
    "male": ["satvik", "anirban", "nakul", "vasant", "siddhant"]
}
ALL_VOICES = MITHI_VOICES["female"] + MITHI_VOICES["male"]

# 11 Supported Indian Languages
MITHI_LANGUAGES = {
    "hi": "Hindi",
    "en": "Indian English",
    "bn": "Bengali",
    "gu": "Gujarati",
    "kn": "Kannada",
    "ml": "Malayalam",
    "mr": "Marathi",
    "or": "Odia",
    "pa": "Punjabi",
    "ta": "Tamil",
    "te": "Telugu"
}

class MithiService:
    _instance = None
    _model = None
    _is_ready = False

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def __init__(self):
        self.try_load_model()

    def try_load_model(self) -> bool:
        """Attempt to load the local Mithi v2 Flash weights if available."""
        if self._is_ready and self._model is not None:
            return True

        decoder_path = MODEL_DIR / "decoder.safetensors"
        run_script = MODEL_DIR / "run.py"

        if not decoder_path.exists() or not run_script.exists():
            logger.info("[Mithi TTS] Model weights downloading or not found in %s", MODEL_DIR)
            self._is_ready = False
            return False

        try:
            # Add model dir to sys.path
            model_dir_str = str(MODEL_DIR.resolve())
            if model_dir_str not in sys.path:
                sys.path.insert(0, model_dir_str)

            from run import Mithi
            logger.info("[Mithi TTS] Loading Mithi v2 Flash weights from %s...", model_dir_str)
            self._model = Mithi(model_dir=model_dir_str, device="cpu")
            self._is_ready = True
            logger.info("[Mithi TTS] Mithi v2 Flash initialized successfully on CPU!")
            return True
        except Exception as e:
            logger.warning("[Mithi TTS] Could not load Mithi weights: %s", e)
            self._is_ready = False
            return False

    def is_available(self) -> bool:
        return self._is_ready or self.try_load_model()

    def get_available_voices(self) -> List[Dict[str, str]]:
        return [
            {"id": v, "name": v.capitalize(), "gender": "female" if v in MITHI_VOICES["female"] else "male"}
            for v in ALL_VOICES
        ]

    def synthesize(
        self,
        text: str,
        lang: str = "hi",
        voice: str = "ahana"
    ) -> Dict[str, Any]:
        """
        Synthesize speech text to 24kHz audio using Mithi v2 Flash.
        Falls back to audio duration estimation if weights are loading.
        """
        clean_text = text.strip()
        word_count = len(clean_text.split())
        
        # Clean language code (e.g. en-IN -> en, hi-IN -> hi)
        clean_lang = lang.split("-")[0].lower()
        if clean_lang not in MITHI_LANGUAGES:
            clean_lang = "hi" if "hi" in lang.lower() else "en"

        clean_voice = voice.lower().strip()
        if clean_voice not in ALL_VOICES:
            clean_voice = "ahana"

        # Unique cache key for this text, lang, and voice
        cache_key = hashlib.md5(f"{clean_lang}:{clean_voice}:{clean_text}".encode()).hexdigest()
        cache_file = AUDIO_CACHE_DIR / f"{cache_key}.wav"
        rel_audio_url = f"/api/v1/speech/audio/{cache_key}.wav"

        # Check if already cached on disk
        if cache_file.exists():
            return {
                "text": clean_text,
                "language": clean_lang,
                "voice": clean_voice,
                "status": "synthesized",
                "audio_url": rel_audio_url,
                "audio_format": "wav",
                "sample_rate": 24000,
                "duration_seconds": round(max(0.8, (word_count / 140.0) * 60.0), 2),
                "model": "Oomni/mithi-v2-flash",
                "cached": True
            }

        # If model is ready, synthesize real audio
        if self.is_available() and self._model is not None:
            try:
                logger.info("[Mithi TTS] Generating audio with Mithi for: '%s' (lang=%s, voice=%s)", clean_text[:40], clean_lang, clean_voice)
                audio_np = self._model.synthesize(clean_text, lang=clean_lang, voice=clean_voice)
                self._model.save(audio_np, str(cache_file))
                duration = round(len(audio_np) / 24000.0, 2)

                return {
                    "text": clean_text,
                    "language": clean_lang,
                    "voice": clean_voice,
                    "status": "synthesized",
                    "audio_url": rel_audio_url,
                    "audio_format": "wav",
                    "sample_rate": 24000,
                    "duration_seconds": duration,
                    "model": "Oomni/mithi-v2-flash",
                    "cached": False
                }
            except Exception as e:
                logger.error("[Mithi TTS] Inference failed: %s", e)

        # Fallback / while weights are downloading
        est_duration = round(max(0.8, (word_count / 140.0) * 60.0), 2)
        return {
            "text": clean_text,
            "language": clean_lang,
            "voice": clean_voice,
            "status": "synthesized",
            "audio_url": None,
            "audio_format": "browser_speech_synthesis",
            "sample_rate": 24000,
            "duration_seconds": est_duration,
            "model": "Oomni/mithi-v2-flash (Browser Fallback)",
            "cached": False
        }

mithi_service = MithiService.get_instance()
