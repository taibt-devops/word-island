"""Generate Word Island images through Game Asset Studio and export them into game/.

The studio (http://127.0.0.1:8765) does the OpenAI calls, background removal, trimming
and sizing; this script only decides *what* to generate and where the results go.

    python tools/assets.py style                 # create / sync the "Word Island" style
    python tools/assets.py anchor [--n 2]        # candidates for the style anchor image
    python tools/assets.py use-anchor ID         # make asset ID the style reference
    python tools/assets.py words [--redo a,b]    # every word image not generated yet
    python tools/assets.py mascot [--redo happy] # mascot base + poses (edits of the base)
    python tools/assets.py backgrounds [--redo animals]
    python tools/assets.py extras [--redo boss:food,hat:home,defeated:school,chest,chest-open]
    python tools/assets.py sheet                 # contact sheets in build/ for review
    python tools/assets.py export                # game/assets/img/** + game/data.js
"""
from __future__ import annotations

import argparse
import io
import json
import re
import sys
import time
from pathlib import Path

import httpx
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content" / "words.json"
MAP = ROOT / "tools" / "asset_map.json"
BUILD = ROOT / "build"
GAME = ROOT / "game"
STUDIO = "http://127.0.0.1:8765"
MAX_SPEND = 4.5     # USD, total shown by the studio; stop before going past it

client = httpx.Client(base_url=STUDIO, timeout=60)


# --- helpers -----------------------------------------------------------------------

def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def content() -> dict:
    return json.loads(CONTENT.read_text(encoding="utf-8"))


def all_words(c: dict) -> list[dict]:
    return [w for t in c["topics"] for w in t["words"]]


def load_map() -> dict:
    if MAP.exists():
        return json.loads(MAP.read_text(encoding="utf-8"))
    return {"style_id": None, "words": {}, "mascot": {}, "backgrounds": {}}


def save_map(m: dict) -> None:
    MAP.write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding="utf-8")


def api(method: str, path: str, **kw):
    r = client.request(method, path, **kw)
    if r.status_code >= 400:
        sys.exit(f"{method} {path} -> {r.status_code}: {r.text}")
    return r.json() if "json" in r.headers.get("content-type", "") else r


def spent() -> float:
    return api("GET", "/api/meta")["total_cost"]


def check_budget(planned: int, each: float = 0.03) -> None:
    now = spent()
    print(f"spent so far ${now:.3f}; planned {planned} images (~${planned * each:.2f})")
    if now + planned * each > MAX_SPEND:
        sys.exit(f"would exceed the ${MAX_SPEND} budget — stopping")


def wait(jobs: dict[str, str]) -> dict[str, dict]:
    """jobs: job_id -> label. Poll until all finish; return job_id -> job."""
    done: dict[str, dict] = {}
    t0 = time.time()
    while len(done) < len(jobs):
        time.sleep(3)
        for jid, label in jobs.items():
            if jid in done:
                continue
            j = api("GET", f"/api/jobs/{jid}")
            if j["status"] in ("done", "error"):
                done[jid] = j
                mark = "ok " if j["status"] == "done" else "ERR"
                print(f"  [{len(done)}/{len(jobs)}] {mark} {label} ({time.time() - t0:.0f}s) {j['error'] or ''}")
    return done


def first_asset(job: dict) -> int | None:
    return job["result"]["asset_ids"][0] if job["status"] == "done" else None


def approve(asset_id: int, name: str) -> None:
    api("PATCH", f"/api/assets/{asset_id}", json={"status": "approved", "name": name})


def reject(asset_id: int | None) -> None:
    if asset_id:
        api("PATCH", f"/api/assets/{asset_id}", json={"status": "rejected"})


# --- commands ----------------------------------------------------------------------

def cmd_style(args) -> None:
    c, m = content(), load_map()
    s = c["style"]
    existing = next((x for x in api("GET", "/api/styles") if x["name"] == s["name"]), None)
    if existing:
        api("PATCH", f"/api/styles/{existing['id']}", json={"prompt": s["prompt"], "recipe": s["recipe"]})
        m["style_id"] = existing["id"]
    else:
        m["style_id"] = api("POST", "/api/styles", json={"name": s["name"], "prompt": s["prompt"],
                                                        "recipe": s["recipe"]})["id"]
    save_map(m)
    print("style id", m["style_id"])


def generate(m: dict, kind: str, description: str, name: str, quality: str, n: int = 1) -> str:
    return api("POST", "/api/generate", json={"kind": kind, "description": description, "name": name,
                                               "style_id": m["style_id"], "quality": quality, "n": n})["id"]


def cmd_anchor(args) -> None:
    c, m = content(), load_map()
    word = next(w for w in all_words(c) if w["en"] == c["anchor"])
    check_budget(args.n)
    done = wait({generate(m, "item", word["image"], word["en"], args.quality, args.n): "anchor " + word["en"]})
    ids = next(iter(done.values()))["result"]["asset_ids"]
    contact_sheet([(str(i), i) for i in ids], BUILD / "anchor.png", cols=len(ids))
    print("candidates:", ids, "-> look at build/anchor.png, then: use-anchor ID")


def cmd_use_anchor(args) -> None:
    c, m = content(), load_map()
    api("PATCH", f"/api/styles/{m['style_id']}", json={"ref_ids": [args.id]})
    m["words"][c["anchor"]] = args.id
    approve(args.id, c["anchor"])
    save_map(m)
    print(f"asset #{args.id} is now the style reference and the '{c['anchor']}' image")


def cmd_words(args) -> None:
    c, m = content(), load_map()
    redo = set(filter(None, (args.redo or "").split(",")))
    todo = [w for w in all_words(c) if w["en"] not in m["words"] or w["en"] in redo]
    if not todo:
        print("all words have images")
        return
    check_budget(len(todo))
    jobs = {generate(m, "item", w["image"], w["en"], args.quality): w["en"] for w in todo}
    for jid, job in wait(jobs).items():
        word = jobs[jid]
        aid = first_asset(job)
        if aid:
            if word in redo:
                reject(m["words"].get(word))
            m["words"][word] = aid
            approve(aid, word)
    save_map(m)
    missing = [w["en"] for w in all_words(c) if w["en"] not in m["words"]]
    print("missing:", missing or "none")


def cmd_mascot(args) -> None:
    c, m = content(), load_map()
    mascot = c["mascot"]
    redo = set(filter(None, (args.redo or "").split(",")))
    if "base" not in m["mascot"] or "base" in redo:
        check_budget(1)
        done = wait({generate(m, "character", mascot["base"], mascot["name"], args.quality): "mascot base"})
        aid = first_asset(next(iter(done.values())))
        if not aid:
            sys.exit("mascot base failed")
        reject(m["mascot"].get("base"))
        m["mascot"] = {"base": aid}
        approve(aid, f"{mascot['name']} base")
        save_map(m)
        redo |= set(mascot["poses"])
    base = m["mascot"]["base"]
    poses = [p for p in mascot["poses"] if p not in m["mascot"] or p in redo]
    if not poses:
        print("mascot complete")
        return
    check_budget(len(poses))
    jobs = {}
    for pose in poses:
        j = api("POST", f"/api/assets/{base}/edit",
                json={"instruction": mascot["poses"][pose], "quality": args.quality, "n": 1})
        jobs[j["id"]] = pose
    for jid, job in wait(jobs).items():
        aid = first_asset(job)
        if aid:
            reject(m["mascot"].get(jobs[jid]))
            m["mascot"][jobs[jid]] = aid
            approve(aid, f"{mascot['name']} {jobs[jid]}")
    save_map(m)


def cmd_backgrounds(args) -> None:
    c, m = content(), load_map()
    redo = set(filter(None, (args.redo or "").split(",")))
    wanted = {"island": c["home_background"], **{t["id"]: t["background"] for t in c["topics"]}}
    todo = {k: v for k, v in wanted.items() if k not in m["backgrounds"] or k in redo}
    if not todo:
        print("all backgrounds done")
        return
    check_budget(len(todo), each=0.05)
    jobs = {generate(m, "background", f"{desc}. {c['background_suffix']}", f"bg {key}", args.quality): key
            for key, desc in todo.items()}
    for jid, job in wait(jobs).items():
        aid = first_asset(job)
        if aid:
            reject(m["backgrounds"].get(jobs[jid]))
            m["backgrounds"][jobs[jid]] = aid
            approve(aid, f"bg {jobs[jid]}")
    save_map(m)


def cmd_extras(args) -> None:
    """Level-mode art: a boss per island (+ a dizzy 'defeated' edit), a reward hat per island, the chest."""
    c, m = content(), load_map()
    bosses, hats, chest = m.setdefault("bosses", {}), m.setdefault("hats", {}), m.setdefault("chest", {})
    redo = set(filter(None, (args.redo or "").split(",")))   # e.g. boss:animals,hat:food,chest

    jobs = {}
    for t in c["topics"]:
        if "base" not in bosses.get(t["id"], {}) or f"boss:{t['id']}" in redo:
            jobs[("boss", t["id"])] = ("character", t["boss"]["image"], f"boss {t['id']}")
        if t["id"] not in hats or f"hat:{t['id']}" in redo:
            jobs[("hat", t["id"])] = ("item", t["hat"]["image"], f"hat {t['hat']['id']}")
    if "closed" not in chest or "chest" in redo:
        jobs[("chest", "closed")] = ("item", c["chest"]["closed"], "chest closed")
    fresh = set()
    if jobs:
        check_budget(len(jobs))
        ids = {generate(m, kind, desc, name, args.quality): key for key, (kind, desc, name) in jobs.items()}
        for jid, job in wait({j: f"{k[0]} {k[1]}" for j, k in ids.items()}).items():
            aid = first_asset(job)
            if not aid:
                continue
            group, key = ids[jid]
            if group == "boss":
                reject(bosses.get(key, {}).get("base"))
                bosses[key] = {"base": aid}
            elif group == "hat":
                reject(hats.get(key))
                hats[key] = aid
            else:
                reject(chest.get("closed"))
                chest["closed"] = aid
            approve(aid, jobs[(group, key)][2])
            fresh.add((group, key))
        save_map(m)

    # Second wave: edits of the bases, so the pose changes but the character stays the same.
    edits = {}
    for t in c["topics"]:
        b = bosses.get(t["id"], {})
        if "base" in b and ("defeated" not in b or ("boss", t["id"]) in fresh or f"defeated:{t['id']}" in redo):
            edits[("boss", t["id"])] = (b["base"], t["boss"]["defeated"])
    if "closed" in chest and ("open" not in chest or ("chest", "closed") in fresh or "chest-open" in redo):
        edits[("chest", "open")] = (chest["closed"], c["chest"]["open"])
    if edits:
        check_budget(len(edits))
        ids = {}
        for key, (base, instruction) in edits.items():
            j = api("POST", f"/api/assets/{base}/edit", json={"instruction": instruction, "quality": args.quality, "n": 1})
            ids[j["id"]] = key
        for jid, job in wait({j: f"{k[0]} {k[1]} edit" for j, k in ids.items()}).items():
            aid = first_asset(job)
            if not aid:
                continue
            group, key = ids[jid]
            if group == "boss":
                reject(bosses[key].get("defeated"))
                bosses[key]["defeated"] = aid
                approve(aid, f"boss {key} defeated")
            else:
                reject(chest.get("open"))
                chest["open"] = aid
                approve(aid, "chest open")
        save_map(m)
    print("bosses:", len(bosses), "hats:", len(hats), "chest:", sorted(chest))


# --- review + export -----------------------------------------------------------------

def fetch_png(asset_id: int) -> Image.Image:
    a = api("GET", f"/api/assets/{asset_id}")
    return Image.open(io.BytesIO(client.get(a["url"]).content)).convert("RGBA")


def contact_sheet(items: list[tuple[str, int]], path: Path, cols: int = 8, cell: int = 200) -> None:
    rows = (len(items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell, rows * (cell + 28)), (245, 240, 230))
    draw = ImageDraw.Draw(sheet)
    font = ImageFont.load_default(size=18)
    for i, (label, aid) in enumerate(items):
        img = fetch_png(aid)
        img.thumbnail((cell - 12, cell - 12))
        x, y = (i % cols) * cell, (i // cols) * (cell + 28)
        sheet.paste(img, (x + (cell - img.width) // 2, y + (cell - img.height) // 2), img)
        draw.text((x + 8, y + cell + 2), f"{label} #{aid}", fill=(40, 30, 20), font=font)
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)
    print("wrote", path)


def cmd_sheet(args) -> None:
    c, m = content(), load_map()
    words = [(w["en"], m["words"][w["en"]]) for w in all_words(c) if w["en"] in m["words"]]
    for k in range(0, len(words), 24):
        contact_sheet(words[k:k + 24], BUILD / f"words-{k // 24 + 1}.png")
    extra = [(f"ollie {k}", v) for k, v in m["mascot"].items()]
    if extra:
        contact_sheet(extra, BUILD / "mascot.png", cols=4)
    bgs = list(m["backgrounds"].items())
    if bgs:
        contact_sheet([(f"bg {k}", v) for k, v in bgs], BUILD / "backgrounds.png", cols=4, cell=360)
    extras = [(f"{k}", v["base"]) for k, v in m.get("bosses", {}).items()]
    extras += [(f"{k} hạ", v["defeated"]) for k, v in m.get("bosses", {}).items() if "defeated" in v]
    extras += [(f"hat {k}", v) for k, v in m.get("hats", {}).items()]
    extras += [(f"chest {k}", v) for k, v in m.get("chest", {}).items()]
    if extras:
        contact_sheet(extras, BUILD / "extras.png", cols=6)


def save_webp(img: Image.Image, path: Path, quality: int, max_side: int | None = None) -> None:
    if max_side and max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.Resampling.LANCZOS)
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6)


EXPORT_CACHE = BUILD / "export-cache.json"


def export_image(cache: dict, aid: int, path: Path, quality: int, max_side: int | None = None, rgb: bool = False) -> None:
    """WebP encoding at method=6 is slow; skip files whose studio asset (id + version) hasn't changed."""
    a = api("GET", f"/api/assets/{aid}")
    key = f"{aid}:{a['version']}:{quality}:{max_side}:{rgb}"
    if path.exists() and cache.get(path.as_posix()) == key:
        return
    img = Image.open(io.BytesIO(client.get(a["url"]).content)).convert("RGBA")
    save_webp(img.convert("RGB") if rgb else img, path, quality, max_side)
    cache[path.as_posix()] = key


def cmd_export(args) -> None:
    c, m = content(), load_map()
    img_dir = GAME / "assets" / "img"
    audio_dir = GAME / "assets" / "audio"
    cache = json.loads(EXPORT_CACHE.read_text(encoding="utf-8")) if EXPORT_CACHE.exists() else {}
    for w in all_words(c):
        if w["en"] in m["words"]:
            export_image(cache, m["words"][w["en"]], img_dir / "words" / f"{slug(w['en'])}.webp", 88)
    for pose, aid in m["mascot"].items():
        export_image(cache, aid, img_dir / f"ollie-{pose}.webp", 88, max_side=512)
    for key, aid in m["backgrounds"].items():
        export_image(cache, aid, img_dir / "bg" / f"{key}.webp", 80, max_side=1600, rgb=True)
    for key, b in m.get("bosses", {}).items():
        export_image(cache, b["base"], img_dir / "boss" / f"{key}.webp", 88, max_side=512)
        if "defeated" in b:
            export_image(cache, b["defeated"], img_dir / "boss" / f"{key}-defeated.webp", 88, max_side=512)
    for key, aid in m.get("hats", {}).items():
        export_image(cache, aid, img_dir / "hats" / f"{key}.webp", 90, max_side=256)
    for key, aid in m.get("chest", {}).items():
        export_image(cache, aid, img_dir / f"chest-{key}.webp", 88, max_side=512)
    EXPORT_CACHE.parent.mkdir(parents=True, exist_ok=True)
    EXPORT_CACHE.write_text(json.dumps(cache, indent=1), encoding="utf-8")

    def audio(name: str) -> str | None:
        return f"assets/audio/{name}.mp3" if (audio_dir / f"{name}.mp3").exists() else None

    def boss(t: dict) -> dict | None:
        b = m.get("bosses", {}).get(t["id"])
        if not b or "boss" not in t:
            return None
        return {"en": t["boss"]["en"], "vi": t["boss"]["vi"], "img": f"assets/img/boss/{t['id']}.webp",
                "defeated": f"assets/img/boss/{t['id']}-defeated.webp" if "defeated" in b else None}

    def hat(t: dict) -> dict | None:
        if t["id"] not in m.get("hats", {}) or "hat" not in t:
            return None
        return {"id": t["hat"]["id"], "vi": t["hat"]["vi"], "img": f"assets/img/hats/{t['id']}.webp"}

    data = {
        "mascot": {pose: f"assets/img/ollie-{pose}.webp" for pose in m["mascot"]},
        "backgrounds": {k: f"assets/img/bg/{k}.webp" for k in m["backgrounds"]},
        "chest": {k: f"assets/img/chest-{k}.webp" for k in m.get("chest", {})},
        "phrases": {p.stem[len("phrase-"):]: f"assets/audio/{p.name}" for p in sorted(audio_dir.glob("phrase-*.mp3"))},
        "topics": [{
            "id": t["id"], "en": t["en"], "vi": t["vi"], "color": t["color"],
            "cover": slug(t.get("cover") or t["words"][0]["en"]),
            "boss": boss(t), "hat": hat(t),
            "words": [{
                "id": slug(w["en"]), "en": w["en"], "vi": w["vi"],
                "sentence": w["sentence"], "sentence_vi": w["sentence_vi"],
                "img": f"assets/img/words/{slug(w['en'])}.webp" if w["en"] in m["words"] else None,
                "audio": audio(slug(w["en"])), "sentence_audio": audio(slug(w["en"]) + "-s"),
                "find_audio": audio("find-" + slug(w["en"])),
            } for w in t["words"]],
        } for t in c["topics"]],
    }
    (GAME / "data.js").write_text(
        "// Generated by tools/assets.py export — do not edit by hand.\nwindow.WORD_ISLAND = "
        + json.dumps(data, indent=1, ensure_ascii=False) + ";\n", encoding="utf-8")
    size = sum(p.stat().st_size for p in (GAME / "assets").rglob("*") if p.is_file())
    print(f"exported; game/assets = {size / 1e6:.1f} MB")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("style").set_defaults(fn=cmd_style)
    a = sub.add_parser("anchor")
    a.add_argument("--n", type=int, default=2)
    a.set_defaults(fn=cmd_anchor)
    u = sub.add_parser("use-anchor")
    u.add_argument("id", type=int)
    u.set_defaults(fn=cmd_use_anchor)
    for name, fn in (("words", cmd_words), ("mascot", cmd_mascot), ("backgrounds", cmd_backgrounds),
                     ("extras", cmd_extras)):
        s = sub.add_parser(name)
        s.add_argument("--redo", default="")
        s.set_defaults(fn=fn)
    sub.add_parser("sheet").set_defaults(fn=cmd_sheet)
    sub.add_parser("export").set_defaults(fn=cmd_export)
    for s in sub.choices.values():
        s.add_argument("--quality", default="medium")
    args = p.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
