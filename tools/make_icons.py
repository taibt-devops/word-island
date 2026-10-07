"""Android launcher icons from Ollie: legacy square icons + adaptive-icon foregrounds."""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "game" / "assets" / "img" / "ollie-wave.webp"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
LAGOON = (31, 181, 201, 255)
DENSITIES = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}

ollie = Image.open(SRC).convert("RGBA")
ollie = ollie.crop(ollie.getchannel("A").getbbox())


def fit(img: Image.Image, box: int) -> Image.Image:
    scale = box / max(img.size)
    return img.resize((round(img.width * scale), round(img.height * scale)), Image.Resampling.LANCZOS)


for name, k in DENSITIES.items():
    out = RES / f"mipmap-{name}"
    out.mkdir(parents=True, exist_ok=True)

    # Adaptive foreground: 108dp canvas, art inside the 66dp safe zone (launchers crop the rest).
    size = round(108 * k)
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    art = fit(ollie, round(size * 0.58))
    fg.paste(art, ((size - art.width) // 2, (size - art.height) // 2 + round(size * 0.02)), art)
    fg.save(out / "ic_launcher_foreground.png")

    # Legacy icon (Android 7): rounded lagoon square with Ollie.
    size = round(48 * k)
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(icon).rounded_rectangle((0, 0, size - 1, size - 1), radius=round(size * 0.22), fill=LAGOON)
    art = fit(ollie, round(size * 0.82))
    icon.paste(art, ((size - art.width) // 2, size - art.height - round(size * 0.04)), art)
    icon.save(out / "ic_launcher.png")

print("icons written to", RES)
