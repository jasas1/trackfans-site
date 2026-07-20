#!/usr/bin/env python3
"""Build the self-contained track data bundle for trackfans.

v0.2: per-record embeds for the detail modal — corner/straight arrays
(`corners_data`), lap-record holder media (`media`), an elevation-data
flag (`elev`), and a simplified lon/lat overlay line (`overlay_pts`)
projected onto the satellite tile. The existing integer `corners` count
field is left untouched so table sorting by corner count keeps working.
"""

from __future__ import annotations

import json
import math
import re
import argparse
from pathlib import Path


ROOT = Path(__file__).resolve().parent


def _find_repo_root() -> Path:
    """Walk up from this script until we find a directory containing both
    `data/` and `site/`. Matches the original `ROOT.parents[0]` resolution
    when build.py lives in site/, and also works when build.py is run from
    a research/<task>/ directory two levels under the repo root."""
    for p in [ROOT, *ROOT.parents]:
        if (p / "data").is_dir() and (p / "site").is_dir():
            return p
    raise RuntimeError(
        "could not locate trackfans repo root (need sibling data/ and site/ dirs)"
    )


REPO = _find_repo_root()
DATA_DIR = REPO / "data"
SITE_DIR = REPO / "site"
OUTLINE_DIR = SITE_DIR / "outlines"
CORNERS_DIR = DATA_DIR / "corners"
MEDIA_DIR = DATA_DIR / "media"
ELEV_DIR = SITE_DIR / "elevation"
OUT = ROOT / "tracks.js"
SEASONS_JSON = SITE_DIR / "seasons.json"
SEASONS_OUT = ROOT / "seasons.js"
SERIES = "f1"

MAX_OVERLAY_POINTS = 200

FLAGS = {
    "Argentina": "🇦🇷",
    "Australia": "🇦🇺",
    "Austria": "🇦🇹",
    "Azerbaijan": "🇦🇿",
    "Bahrain": "🇧🇭",
    "Belgium": "🇧🇪",
    "Brazil": "🇧🇷",
    "Canada": "🇨🇦",
    "China": "🇨🇳",
    "France": "🇫🇷",
    "Germany": "🇩🇪",
    "Hungary": "🇭🇺",
    "India": "🇮🇳",
    "Indonesia": "🇮🇩",
    "Isle of Man": "🇮🇲",
    "Italy": "🇮🇹",
    "Japan": "🇯🇵",
    "Malaysia": "🇲🇾",
    "Mexico": "🇲🇽",
    "Monaco": "🇲🇨",
    "Morocco": "🇲🇦",
    "Netherlands": "🇳🇱",
    "Portugal": "🇵🇹",
    "Qatar": "🇶🇦",
    "Russia": "🇷🇺",
    "Saudi Arabia": "🇸🇦",
    "Singapore": "🇸🇬",
    "South Africa": "🇿🇦",
    "South Korea": "🇰🇷",
    "Spain": "🇪🇸",
    "Sweden": "🇸🇪",
    "Switzerland": "🇨🇭",
    "Thailand": "🇹🇭",
    "Turkey": "🇹🇷",
    "United Arab Emirates": "🇦🇪",
    "United Kingdom": "🇬🇧",
    "United States": "🇺🇸",
    "Venezuela": "🇻🇪",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build trackfans data bundles for Formula 1 or MotoGP."
    )
    parser.add_argument(
        "--series",
        choices=("f1", "motogp"),
        default="f1",
        help="Series bundle to build. Defaults to Formula 1.",
    )
    return parser.parse_args()


def configure_series(series: str) -> None:
    global DATA_DIR, CORNERS_DIR, MEDIA_DIR, OUT, SEASONS_JSON, SEASONS_OUT, SERIES

    SERIES = series
    if series == "motogp":
        DATA_DIR = REPO / "data-motogp"
        OUT = ROOT / "tracks-motogp.js"
        SEASONS_JSON = SITE_DIR / "seasons-motogp.json"
        SEASONS_OUT = ROOT / "seasons-motogp.js"
    else:
        DATA_DIR = REPO / "data"
        OUT = ROOT / "tracks.js"
        SEASONS_JSON = SITE_DIR / "seasons.json"
        SEASONS_OUT = ROOT / "seasons.js"

    CORNERS_DIR = DATA_DIR / "corners"
    MEDIA_DIR = DATA_DIR / "media"


def read_outline_path(track_id: str) -> str | None:
    svg_path = OUTLINE_DIR / f"{track_id}.svg"
    if not svg_path.exists():
        return None
    text = svg_path.read_text(encoding="utf-8")
    match = re.search(r"<path\b[^>]*\bd=[\"']([^\"']+)[\"']", text)
    if not match:
        raise ValueError(f"Outline has no path d attribute: {svg_path}")
    return match.group(1)


def _extract_linestring(geojson: dict) -> list | None:
    """Pull the first LineString coordinates out of a Feature or
    FeatureCollection geojson."""
    if not isinstance(geojson, dict):
        return None
    geom = geojson.get("geometry")
    if isinstance(geom, dict) and geom.get("type") == "LineString":
        return geom.get("coordinates") or []
    feats = geojson.get("features")
    if isinstance(feats, list):
        for feat in feats:
            if not isinstance(feat, dict):
                continue
            g = feat.get("geometry")
            if isinstance(g, dict) and g.get("type") == "LineString":
                return g.get("coordinates") or []
    return None


def _perp_distance(p: list[float], a: list[float], b: list[float]) -> float:
    """Perpendicular distance from p to segment a-b in lon/lat degrees.
    Planar formula is sufficient at circuit scale; equirectangular
    distortion over a few km is negligible for the overlay use case."""
    ax, ay = a[0], a[1]
    bx, by = b[0], b[1]
    px, py = p[0], p[1]
    dx = bx - ax
    dy = by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
    if t < 0:
        cx, cy = ax, ay
    elif t > 1:
        cx, cy = bx, by
    else:
        cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def _douglas_peucker(pts: list[list[float]], eps: float) -> list[list[float]]:
    """Iterative Douglas-Peucker. eps is in geographic degrees."""
    if len(pts) < 3:
        return pts[:]
    keep = [False] * len(pts)
    keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        start, end = stack.pop()
        if end <= start + 1:
            continue
        a = pts[start]
        b = pts[end]
        dmax = 0.0
        index = start
        for i in range(start + 1, end):
            d = _perp_distance(pts[i], a, b)
            if d > dmax:
                dmax = d
                index = i
        if dmax > eps:
            keep[index] = True
            stack.append((start, index))
            stack.append((index, end))
    return [pts[i] for i, k in enumerate(keep) if k]


def simplify_linestring(pts: list[list[float]], max_points: int) -> list[list[float]]:
    """Reduce pts to <= max_points by adaptive Douglas-Peucker, with an
    every-Nth decimation fallback if DP alone cannot bring the count down
    (e.g. evenly-spaced points along a smooth curve)."""
    if len(pts) <= max_points:
        return pts
    lo, hi = 0.0, 0.05
    best = pts
    for _ in range(48):
        mid = (lo + hi) / 2
        candidate = _douglas_peucker(pts, mid)
        if len(candidate) <= max_points:
            best = candidate
            hi = mid
        else:
            lo = mid
    if len(best) > max_points:
        step = math.ceil(len(best) / max_points)
        best = best[::step][:max_points]
    # Guarantee endpoints survive.
    if best and best[0] != pts[0]:
        best[0] = pts[0]
    if best and best[-1] != pts[-1]:
        best[-1] = pts[-1]
    return best


def read_overlay_points(track_id: str) -> list | None:
    """Read the circuit's geojson LineString and simplify it to <=200
    [lon, lat] points for the satellite-tile overlay. Returns None when
    there is no geojson (some circuits ship an SVG outline only)."""
    geo_path = OUTLINE_DIR / f"{track_id}.geojson"
    if not geo_path.exists():
        return None
    try:
        data = json.loads(geo_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    coords = _extract_linestring(data)
    if not coords or len(coords) < 2:
        return None
    pts = [[float(c[0]), float(c[1])] for c in coords]
    return simplify_linestring(pts, MAX_OVERLAY_POINTS)


def read_corners_data(track_id: str) -> dict | None:
    path = CORNERS_DIR / f"{track_id}.json"
    if not path.exists():
        return None
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None
    corners = data.get("corners") or []
    straights = data.get("straights") or []
    if not corners and not straights:
        return None
    return {"corners": corners, "straights": straights}


def read_media(track_id: str) -> dict | None:
    path = MEDIA_DIR / f"{track_id}.json"
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def has_elevation(track_id: str) -> bool:
    return (ELEV_DIR / f"{track_id}.json").exists()


def write_seasons() -> int:
    """Regenerate seasons.js from seasons.json on every build."""
    if SEASONS_JSON.exists():
        seasons_obj = json.loads(SEASONS_JSON.read_text(encoding="utf-8"))
    else:
        seasons_obj = {}
    payload = json.dumps(seasons_obj, ensure_ascii=False, separators=(",", ":"))
    SEASONS_OUT.write_text(
        "// Generated by build.py. Do not edit by hand.\n"
        f"const SEASONS = {payload};\n",
        encoding="utf-8",
    )
    return len(seasons_obj)


def main() -> None:
    args = parse_args()
    configure_series(args.series)

    records = []
    outline_files = []
    for path in sorted(DATA_DIR.glob("*.json")):
        record = json.loads(path.read_text(encoding="utf-8"))
        if record["id"] != path.stem:
            raise ValueError(f"id/filename mismatch: {path}")
        outline_d = read_outline_path(record["id"])
        record["outline_d"] = outline_d
        record["outline_id"] = record["id"] if outline_d else None
        if outline_d:
            outline_files.append(f"{record['id']}.svg")
        record["flag"] = FLAGS.get(record["country"], "")

        # v0.2 detail-modal embeds. `corners_data` is named to avoid
        # clobbering the existing integer `corners` field used by the
        # sortable table column.
        corners_data = read_corners_data(record["id"])
        if corners_data:
            record["corners_data"] = corners_data
        elif SERIES == "motogp":
            record["corners_data"] = None
        media = read_media(record["id"])
        if media:
            record["media"] = media
        elif SERIES == "motogp":
            record["media"] = None
        record["elev"] = has_elevation(record["id"])
        overlay = read_overlay_points(record["id"])
        if overlay:
            record["overlay_pts"] = overlay
        elif SERIES == "motogp":
            record["overlay_pts"] = None

        records.append(record)

    payload = json.dumps(records, ensure_ascii=False, separators=(",", ":"))
    outline_payload = json.dumps(outline_files, separators=(",", ":"))
    OUT.write_text(
        "// Generated by build.py. Do not edit by hand.\n"
        f"window.TRACKFANS_OUTLINE_FILES = {outline_payload};\n"
        f"window.TRACKFANS_TRACKS = {payload};\n",
        encoding="utf-8",
    )
    outlines = sum(1 for r in records if r["outline_d"])
    corners_n = sum(1 for r in records if r.get("corners_data"))
    media_n = sum(1 for r in records if r.get("media"))
    elev_n = sum(1 for r in records if r.get("elev"))
    overlay_n = sum(1 for r in records if r.get("overlay_pts"))
    print(
        f"Wrote {OUT.name}: {len(records)} circuits, {outlines} outlines, "
        f"{corners_n} corner sets, {media_n} media, {elev_n} elev, "
        f"{overlay_n} overlays"
    )

    season_count = write_seasons()
    print(f"Wrote {SEASONS_OUT.name}: {season_count} seasons")


if __name__ == "__main__":
    main()
