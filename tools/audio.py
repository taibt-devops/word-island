"""Pre-render pronunciation mp3s with OpenAI TTS so the game works offline.

    python tools/audio.py            # missing clips only
    python tools/audio.py --force    # re-render everything

Key: OPENAI_API_KEY env var, else the Game Asset Studio .env next door.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "game" / "assets" / "audio"
STUDIO_ENV = Path(r"D:\code\game-asset-studio\.env")

MODEL, VOICE = "gpt-4o-mini-tts", "coral"
FALLBACK_MODEL, FALLBACK_VOICE = "tts-1", "nova"
INSTRUCTIONS = ("You are a warm, cheerful English teacher for young children. Speak in clear standard American "
                "English, slowly and naturally, with friendly intonation.")

PHRASES = {
    "great": "Great job!",
    "excellent": "Excellent!",
    "well-done": "Well done!",
    "try-again": "Oops! Try again.",
    "welcome": "Hello! I'm Ollie. Let's learn English together!",
    "ready": "Ready? Go!",
    "level-complete": "Level complete!",
    "time-up": "Time's up!",
    "oh-no": "Oh no! Let's try again.",
    "boss": "Here comes the boss! You can do it!",
    "you-win": "You did it! Hooray!",
    "treasure": "Wow! A treasure chest!",
}


def api_key() -> str:
    key = os.getenv("OPENAI_API_KEY")
    if not key and STUDIO_ENV.exists():
        for line in STUDIO_ENV.read_text(encoding="utf-8").splitlines():
            if line.startswith("OPENAI_API_KEY="):
                key = line.split("=", 1)[1].strip()
    if not key:
        sys.exit("no OPENAI_API_KEY")
    return key


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


class TTS:
    def __init__(self, key: str):
        self.client = httpx.Client(base_url="https://api.openai.com/v1", timeout=60,
                                   headers={"Authorization": f"Bearer {key}"})
        self.model, self.voice = MODEL, VOICE

    def render(self, text: str) -> bytes:
        body = {"model": self.model, "voice": self.voice, "input": text, "response_format": "mp3"}
        if self.model == MODEL:
            body["instructions"] = INSTRUCTIONS
        r = self.client.post("/audio/speech", json=body)
        if r.status_code in (400, 403, 404) and self.model == MODEL:
            print(f"  {MODEL} unavailable ({r.status_code}), falling back to {FALLBACK_MODEL}")
            self.model, self.voice = FALLBACK_MODEL, FALLBACK_VOICE
            return self.render(text)
        r.raise_for_status()
        return r.content


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    content = json.loads((ROOT / "content" / "words.json").read_text(encoding="utf-8"))
    clips = {f"phrase-{k}": v for k, v in PHRASES.items()}
    for topic in content["topics"]:
        for w in topic["words"]:
            clips[slug(w["en"])] = w["en"]
            clips[slug(w["en"]) + "-s"] = w["sentence"]
            clips["find-" + slug(w["en"])] = f"Can you find the {w['en']}?"   # hidden-object prompt
    todo = {name: text for name, text in clips.items() if args.force or not (OUT / f"{name}.mp3").exists()}
    if not todo:
        print("all clips present")
        return
    OUT.mkdir(parents=True, exist_ok=True)
    tts = TTS(api_key())
    tts.render("Hello")   # settle the model choice before going parallel
    print(f"rendering {len(todo)} clips with {tts.model}/{tts.voice}")

    def one(item):
        name, text = item
        (OUT / f"{name}.mp3").write_bytes(tts.render(text))
        return name

    with ThreadPoolExecutor(4) as pool:
        for i, name in enumerate(pool.map(one, todo.items()), 1):
            if i % 20 == 0 or i == len(todo):
                print(f"  {i}/{len(todo)}")
    chars = sum(len(t) for t in todo.values())
    print(f"done: {len(todo)} clips, {chars} characters")


if __name__ == "__main__":
    main()
