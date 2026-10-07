"""Download Baloo 2 (SIL Open Font License) into game/assets/fonts so the game needs no network."""
import re
from pathlib import Path

import httpx

OUT = Path(__file__).resolve().parent.parent / "game" / "assets" / "fonts"
CSS_URL = "https://fonts.googleapis.com/css2?family=Baloo+2:wght@500..800&display=swap"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"
KEEP = ("vietnamese", "latin-ext", "latin")

css = httpx.get(CSS_URL, headers={"User-Agent": UA}, timeout=30).text
OUT.mkdir(parents=True, exist_ok=True)
blocks = re.findall(r"/\* ([\w-]+) \*/\s*(@font-face \{.*?\})", css, re.S)
out_css = []
for subset, block in blocks:
    if subset not in KEEP:
        continue
    url = re.search(r"url\((https://[^)]+\.woff2)\)", block).group(1)
    name = f"baloo2-{subset}.woff2"
    (OUT / name).write_bytes(httpx.get(url, timeout=30).content)
    out_css.append(f"/* {subset} */\n" + block.replace(url, f"{name}"))
(OUT / "baloo2.css").write_text("\n".join(out_css) + "\n", encoding="utf-8")
print("saved", [p.name for p in OUT.iterdir()])
