const tracks = Array.isArray(window.TRACKFANS_TRACKS) ? window.TRACKFANS_TRACKS : [];
const seasonData = typeof SEASONS === "object" ? SEASONS : {};

const state = {
  query: "",
  status: "all",
  sortKey: "name",
  sortDir: "asc",
  lastFocus: null,
  view: "atlas",
  seasonYear: "2026",
  satelliteZoom: {},
};

const rowsEl = document.querySelector("#track-rows");
const searchEl = document.querySelector("#search");
const countEl = document.querySelector("#result-count");
const modal = document.querySelector("#detail-modal");
const modalPanel = modal.querySelector(".modal__panel");
const detailEl = document.querySelector("#detail-content");
const closeSelectors = "[data-close]";
const dash = "—";
const satelliteZoomScales = [2.4, 1.6, 1.0, 0.55];

const theadEl = document.querySelector("thead");
const tableEl = document.querySelector("table");
const seasonToggle = document.querySelector("#season-toggle");
const yearSelect = document.querySelector("#season-year");
const yearWrap = document.querySelector(".season-year-wrap");
const chipsGroup = document.querySelector(".chips");
const atlasTheadHTML = theadEl.innerHTML;

const seasonTheadHTML = `<tr>
                <th scope="col">Rd</th>
                <th scope="col">Grand Prix</th>
                <th scope="col">Track</th>
                <th scope="col">Length km</th>
                <th scope="col">Corners</th>
                <th scope="col">Top speed</th>
              </tr>`;

const numericKeys = new Set([
  "first_gp_year",
  "grands_prix_held",
  "length_km",
  "corners",
  "top_speed_kmh",
  "elevation_change_m",
  "area_acres",
]);

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isBlank(value) {
  return value === null || value === undefined || value === "";
}

function formatValue(value, digits = 0) {
  if (isBlank(value)) return dash;
  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US", {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value);
  }
  return escapeHtml(value);
}

function formatYear(value) {
  return isBlank(value) ? dash : String(value);
}

function formatLapRecord(record) {
  if (!record || !record.time) return dash;
  const driver = record.driver ? `, ${escapeHtml(record.driver)}` : "";
  const year = record.year ? ` (${record.year})` : "";
  return `${escapeHtml(record.time)}${driver}${year}`;
}

function formatMaybeNumber(value, digits = 0) {
  if (isBlank(value)) return "";
  return formatValue(value, digits);
}

function getTrackSeasons(track) {
  const years = [];
  let raceCount = 0;
  Object.entries(seasonData).forEach(([year, races]) => {
    if (!Array.isArray(races)) return;
    const found = races.filter((race) => race.circuit_id === track.id).length;
    if (found) {
      years.push(Number(year));
      raceCount += found;
    }
  });
  return { years: [...new Set(years)].sort((a, b) => a - b), raceCount };
}

function formatEraStrip(years) {
  if (!years.length) return "";
  const eras = [];
  let start = years[0];
  let prev = years[0];
  for (let i = 1; i < years.length; i += 1) {
    const year = years[i];
    if (year === prev + 1) {
      prev = year;
    } else {
      eras.push(start === prev ? String(start) : `${start}-${prev}`);
      start = prev = year;
    }
  }
  eras.push(start === prev ? String(start) : `${start}-${prev}`);
  return eras.join(" - ");
}

function racesSpanHtml(track) {
  if (Number(track.grands_prix_held) === 0) {
    return `debut ${formatYear(track.first_gp_year)}`;
  }
  const { years, raceCount } = getTrackSeasons(track);
  if (!years.length) return dash;
  const first = years[0];
  const last = years[years.length - 1];
  const count = raceCount || Number(track.grands_prix_held) || years.length;
  const era = formatEraStrip(years);
  const hasGaps = era.includes(" - ");
  return `${formatValue(count)} Grands Prix - ${first}-${last}${hasGaps ? `<span>${escapeHtml(era)}</span>` : ""}`;
}

function pathPointsFromD(d) {
  const nums = String(d || "").match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
  const pts = [];
  for (let i = 0; i < nums.length - 1; i += 2) pts.push({ x: nums[i], y: nums[i + 1] });
  return pts;
}

function distance(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function withArcLengths(pts) {
  let total = 0;
  return pts.map((pt, i) => {
    if (i) total += distance(pts[i - 1], pt);
    return { ...pt, s: total };
  });
}

function pointAtArc(arcPts, target) {
  if (!arcPts.length) return null;
  if (target <= 0) return arcPts[0];
  for (let i = 1; i < arcPts.length; i += 1) {
    const prev = arcPts[i - 1];
    const next = arcPts[i];
    if (next.s >= target) {
      const span = next.s - prev.s || 1;
      const t = (target - prev.s) / span;
      return { x: prev.x + (next.x - prev.x) * t, y: prev.y + (next.y - prev.y) * t, s: target };
    }
  }
  return arcPts[arcPts.length - 1];
}

function angleBetween(a, b, c) {
  const v1x = a.x - b.x;
  const v1y = a.y - b.y;
  const v2x = c.x - b.x;
  const v2y = c.y - b.y;
  const mag = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y);
  if (!mag) return 0;
  const cos = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / mag));
  return Math.PI - Math.acos(cos);
}

function cornerMarkerPositions(track) {
  const corners = track.corners_data?.corners || [];
  const pts = pathPointsFromD(track.outline_d);
  if (!corners.length || pts.length < 3) return [];
  const arcPts = withArcLengths(pts);
  const total = arcPts[arcPts.length - 1].s || 1;
  const windowSize = Math.max(2, Math.round(pts.length / 80));
  const scored = [];
  for (let i = windowSize; i < pts.length - windowSize; i += 1) {
    const score = angleBetween(pts[i - windowSize], pts[i], pts[i + windowSize]);
    if (score > 0.18) scored.push({ ...arcPts[i], score });
  }
  scored.sort((a, b) => b.score - a.score);
  const minSpacing = total / Math.max(corners.length * 1.75, 1);
  const candidates = [];
  scored.forEach((item) => {
    if (candidates.every((c) => Math.abs(c.s - item.s) > minSpacing)) candidates.push(item);
  });
  candidates.sort((a, b) => a.s - b.s);

  // Corner labels are official sequence data, while the SVG path is a simplified
  // sampled outline. When curvature candidates match the official count we use
  // them directly from path start; otherwise we distribute labels by arc length
  // so every official corner remains represented without inventing extra turns.
  const positions = candidates.length === corners.length
    ? candidates
    : corners.map((_, i) => pointAtArc(arcPts, total * ((i + 1) / (corners.length + 1))));
  return positions.map((pt, i) => ({ ...pt, corner: corners[i] })).filter((item) => item.x !== undefined);
}

function outlineSvg(track, sizeClass = "outline-thumb") {
  if (!track.outline_d) {
    return `<span class="${sizeClass} outline-empty" aria-label="No outline available">${dash}</span>`;
  }
  return `<svg class="${sizeClass}" viewBox="0 0 1000 1000" role="img" aria-label="${escapeHtml(track.name)} track outline"><path d="${escapeHtml(track.outline_d)}" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function detailOutlineSvg(track) {
  if (!track.outline_d) return outlineSvg(track, "outline-large");
  const markers = cornerMarkerPositions(track);
  return `<div class="outline-detail">
    <svg class="outline-large" viewBox="0 0 1000 1000" role="img" aria-label="${escapeHtml(track.name)} track outline"><path d="${escapeHtml(track.outline_d)}" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>${markers.map(({ x, y, corner }) => `<g class="corner-marker" aria-hidden="true"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="19"/><text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}">${escapeHtml(corner.n)}</text></g>`).join("")}</svg>
    ${markers.length ? `<button class="outline-toggle" type="button" data-corners-toggle aria-pressed="true">Corners</button>` : ""}
  </div>`;
}

function statusLabel(status) {
  return status === "current" ? "Current" : status === "future" ? "Future" : "Historical";
}

function statusBadge(status) {
  return `<span class="badge badge--${escapeHtml(status)}">${statusLabel(status)}</span>`;
}

function searchable(track) {
  return [
    track.name,
    track.country,
    track.region,
    track.status,
    track.circuit_type,
    ...(track.aka || []),
  ].join(" ").toLowerCase();
}

function compareTracks(a, b) {
  const key = state.sortKey;
  const av = a[key];
  const bv = b[key];
  const aNull = isBlank(av);
  const bNull = isBlank(bv);
  if (aNull && bNull) return a.name.localeCompare(b.name);
  if (aNull) return 1;
  if (bNull) return -1;

  let result;
  if (numericKeys.has(key)) {
    result = Number(av) - Number(bv);
  } else {
    result = String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
  }
  if (result === 0) result = a.name.localeCompare(b.name);
  return state.sortDir === "asc" ? result : -result;
}

function currentRows() {
  const query = state.query.trim().toLowerCase();
  return tracks
    .filter((track) => state.status === "all" || track.status === state.status)
    .filter((track) => !query || searchable(track).includes(query))
    .sort(compareTracks);
}

function trackCellHtml(track) {
  return `<div class="track-cell">
          ${outlineSvg(track)}
          <div>
            <strong>${escapeHtml(track.name)}</strong>
            <span>${escapeHtml(track.flag)} ${escapeHtml(track.country)}</span>
          </div>
        </div>`;
}

function renderTable() {
  if (state.view === "season") {
    renderSeasonTable();
    return;
  }
  const rows = currentRows();
  rowsEl.innerHTML = rows.map((track) => `
    <tr tabindex="0" role="button" data-id="${escapeHtml(track.id)}" aria-label="Open details for ${escapeHtml(track.name)}">
      <td data-label="Track">
        ${trackCellHtml(track)}
      </td>
      <td data-label="Status">${statusBadge(track.status)}</td>
      <td data-label="First GP">${formatYear(track.first_gp_year)}</td>
      <td data-label="GPs held">${formatValue(track.grands_prix_held)}</td>
      <td data-label="Length km">${formatValue(track.length_km, 3)}</td>
      <td data-label="Corners">${formatValue(track.corners)}</td>
      <td data-label="Top speed km/h">${formatValue(track.top_speed_kmh, 1)}</td>
      <td data-label="Elevation change m">${formatValue(track.elevation_change_m)}</td>
      <td data-label="Area acres">${formatValue(track.area_acres, 1)}</td>
    </tr>
  `).join("");
  countEl.textContent = `${rows.length} ${rows.length === 1 ? "circuit" : "circuits"} shown`;
}

function renderSeasonTable() {
  const year = state.seasonYear;
  const races = (seasonData[year] || []).slice().sort((a, b) => a.round - b.round);
  const query = state.query.trim().toLowerCase();
  const enriched = races.map((race) => ({
    race,
    track: tracks.find((t) => t.id === race.circuit_id),
  }));
  const rows = enriched.filter(({ race, track }) => {
    if (!query) return true;
    return [race.gp_name, track?.name, track?.country]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  rowsEl.innerHTML = rows
    .map(({ race, track }) => {
      const label = `Open details for ${escapeHtml(race.gp_name)} at ${escapeHtml(track ? track.name : race.circuit_id)}`;
      return `
    <tr tabindex="0" role="button" data-id="${escapeHtml(race.circuit_id)}" aria-label="${label}">
      <td data-label="Rd">${formatValue(race.round)}</td>
      <td data-label="Grand Prix"><div class="gp-cell"><strong>${escapeHtml(race.gp_name)}</strong><span class="gp-date">${escapeHtml(race.date || dash)}</span></div></td>
      <td data-label="Track">${track ? trackCellHtml(track) : escapeHtml(race.circuit_id)}</td>
      <td data-label="Length km">${track ? formatValue(track.length_km, 3) : dash}</td>
      <td data-label="Corners">${track ? formatValue(track.corners) : dash}</td>
      <td data-label="Top speed km/h">${track ? formatValue(track.top_speed_kmh, 1) : dash}</td>
    </tr>`;
    })
    .join("");
  countEl.textContent = `${rows.length} ${rows.length === 1 ? "race" : "races"} - ${year} season`;
}

function updateSortHeaders() {
  const inSeason = state.view === "season";
  document.querySelectorAll("th").forEach((th) => {
    const button = th.querySelector("button[data-sort]");
    const indicator = button?.querySelector("span");
    const active = !inSeason && button?.dataset.sort === state.sortKey;
    if (active) {
      th.setAttribute("aria-sort", state.sortDir === "asc" ? "ascending" : "descending");
    } else {
      th.removeAttribute("aria-sort");
    }
    if (indicator) indicator.textContent = active ? (state.sortDir === "asc" ? "▲" : "▼") : "";
  });
}

function setSort(key) {
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  } else {
    state.sortKey = key;
    state.sortDir = "asc";
  }
  updateSortHeaders();
  renderTable();
}

function populateSeasonYears() {
  const years = Object.keys(seasonData).sort((a, b) => Number(b) - Number(a));
  yearSelect.innerHTML = years
    .map((y) => `<option value="${escapeHtml(y)}">${escapeHtml(y)}</option>`)
    .join("");
  if (years.includes("2026")) {
    yearSelect.value = "2026";
  } else if (years.length) {
    yearSelect.value = years[0];
  }
  state.seasonYear = yearSelect.value;
}

function setView(mode) {
  if (mode === state.view) return;
  state.view = mode;
  const season = mode === "season";
  seasonToggle.setAttribute("aria-pressed", String(season));
  seasonToggle.classList.toggle("is-active", season);
  yearWrap.hidden = !season;
  chipsGroup.hidden = season;
  tableEl.classList.toggle("is-season", season);
  if (season) {
    theadEl.innerHTML = seasonTheadHTML;
    if (yearSelect.value) state.seasonYear = yearSelect.value;
  } else {
    theadEl.innerHTML = atlasTheadHTML;
    state.sortKey = "name";
    state.sortDir = "asc";
  }
  updateSortHeaders();
  renderTable();
}

function satelliteBox(track, zoomIndex = 1) {
  const lat = track.location?.lat;
  const lon = track.location?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return "";
  let minLon;
  let maxLon;
  let minLat;
  let maxLat;
  if (Array.isArray(track.overlay_pts) && track.overlay_pts.length >= 2) {
    minLon = Math.min(...track.overlay_pts.map((p) => p[0]));
    maxLon = Math.max(...track.overlay_pts.map((p) => p[0]));
    minLat = Math.min(...track.overlay_pts.map((p) => p[1]));
    maxLat = Math.max(...track.overlay_pts.map((p) => p[1]));
  } else {
    const delta = Math.min(Math.max((Number(track.length_km) || 5) / 85, 0.025), 0.16);
    minLon = lon - delta;
    maxLon = lon + delta;
    minLat = lat - delta;
    maxLat = lat + delta;
  }
  const scale = satelliteZoomScales[zoomIndex] || satelliteZoomScales[1];
  // Web Mercator (EPSG:3857) throughout: the Esri export service silently
  // expands a bbox whose aspect doesn't match the pixel size, which shifted
  // the overlay off the tarmac in degree space. In meters we can match the
  // 800x500 aspect exactly, so the returned image covers precisely this bbox.
  const m = (pt) => mercator(pt[0], pt[1]);
  const corners = [m([minLon, minLat]), m([maxLon, maxLat])];
  const midX = (corners[0].x + corners[1].x) / 2;
  const midY = (corners[0].y + corners[1].y) / 2;
  let halfW = Math.max(Math.abs(corners[1].x - corners[0].x) / 2, 400) * scale;
  let halfH = Math.max(Math.abs(corners[1].y - corners[0].y) / 2, 250) * scale;
  if (halfW / halfH > 800 / 500) halfH = halfW * (500 / 800);
  else halfW = halfH * (800 / 500);
  const bbox = [midX - halfW, midY - halfH, midX + halfW, midY + halfH];
  return { bbox, url: satelliteUrlFromBbox(bbox), label: `${zoomIndex + 1} of ${satelliteZoomScales.length}` };
}

function mercator(lon, lat) {
  const R = 6378137;
  const clampedLat = Math.max(-85, Math.min(85, lat));
  return {
    x: (lon * Math.PI * R) / 180,
    y: R * Math.log(Math.tan(Math.PI / 4 + (clampedLat * Math.PI) / 360)),
  };
}

function satelliteUrlFromBbox(bbox) {
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox.map((n) => n.toFixed(2)).join(",")}&bboxSR=3857&imageSR=3857&size=800,500&format=jpg&f=image`;
}

function projectPoint(lon, lat, bbox) {
  const [minX, minY, maxX, maxY] = bbox;
  const p = mercator(lon, lat);
  return {
    x: ((p.x - minX) / (maxX - minX)) * 800,
    y: ((maxY - p.y) / (maxY - minY)) * 500,
  };
}

function satelliteOverlay(track, bbox) {
  const pts = Array.isArray(track.overlay_pts) ? track.overlay_pts : [];
  const line = pts.length >= 2
    ? pts.map(([lon, lat]) => {
        const p = projectPoint(lon, lat, bbox);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(" ")
    : "";
  const area = areaSquare(track, bbox);
  return `<svg class="satellite__overlay" viewBox="0 0 800 500" aria-hidden="true" focusable="false">
    ${line ? `<polyline points="${line}"/>` : ""}
    ${area}
  </svg>`;
}

function areaSquare(track, bbox) {
  if (isBlank(track.area_acres)) return "";
  const sideM = Math.sqrt(Number(track.area_acres) * 4046.86);
  if (!Number.isFinite(sideM) || sideM <= 0) return "";
  const lat = track.location?.lat;
  const metersPerDegLat = 111320;
  const metersPerDegLon = 111320 * Math.cos((Number(lat) || 0) * Math.PI / 180) || 1;
  const sideLon = sideM / metersPerDegLon;
  const sideLat = sideM / metersPerDegLat;
  const [minLon,, maxLon, maxLat] = bbox;
  const marginLon = (maxLon - minLon) * 0.055;
  const marginLat = (bbox[3] - bbox[1]) * 0.075;
  const anchorLon = minLon + marginLon;
  const anchorLat = maxLat - marginLat;
  const p1 = projectPoint(anchorLon, anchorLat, bbox);
  const p2 = projectPoint(anchorLon + sideLon, anchorLat - sideLat, bbox);
  const w = Math.max(4, p2.x - p1.x);
  const h = Math.max(4, p2.y - p1.y);
  return `<rect class="satellite__area" x="${p1.x.toFixed(1)}" y="${p1.y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/><text class="satellite__area-label" x="${p1.x.toFixed(1)}" y="${Math.max(14, p1.y - 6).toFixed(1)}">~ site area (approx.)</text>`;
}

function satelliteFigure(track) {
  const box = satelliteBox(track, state.satelliteZoom[track.id] ?? 1);
  if (!box) return `<figure class="satellite"><div class="image-fallback" role="img" aria-label="Satellite view unavailable">${dash}</div><figcaption>World Imagery context around the circuit coordinates.</figcaption></figure>`;
  return `<figure class="satellite" data-satellite-track="${escapeHtml(track.id)}">
    <div class="satellite__toolbar" role="group" aria-label="Satellite zoom controls">
      <button type="button" data-sat-zoom="out" aria-label="Zoom satellite out">−</button>
      <button type="button" data-sat-zoom="reset" aria-label="Reset satellite zoom">Reset</button>
      <button type="button" data-sat-zoom="in" aria-label="Zoom satellite in">+</button>
    </div>
    <div class="satellite__frame">
      <img src="${box.url}" loading="lazy" alt="Satellite view of ${escapeHtml(track.name)} near ${escapeHtml(track.region || track.country)}">
      ${satelliteOverlay(track, box.bbox)}
    </div>
    <figcaption>World Imagery context around the circuit coordinates. Zoom ${box.label}.</figcaption>
  </figure>`;
}

function worldInset(track) {
  const lat = track.location?.lat;
  const lon = track.location?.lon;
  const label = `Location: ${escapeHtml(track.region || track.country || track.name)}`;
  const landPath = typeof WORLD_LAND_PATH === "string" ? WORLD_LAND_PATH : "";
  if (typeof lat !== "number" || typeof lon !== "number") {
    return `<svg class="world-inset" viewBox="0 0 1000 500" role="img" aria-label="${label}"><path d="${escapeHtml(landPath)}" class="world-inset__land"/></svg>`;
  }
  const cx = ((lon + 180) / 360) * 1000;
  const cy = ((90 - lat) / 180) * 500;
  return `<svg class="world-inset" viewBox="0 0 1000 500" role="img" aria-label="${label}"><path d="${escapeHtml(landPath)}" class="world-inset__land"/><circle class="world-inset__pulse" cx="${cx}" cy="${cy}" r="15"/><circle class="world-inset__dot" cx="${cx}" cy="${cy}" r="7"/></svg>`;
}

function detailStat(label, value) {
  return `<div class="detail-stat"><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`;
}

function mediaCreditHtml(media) {
  if (!media?.thumb_url) return "";
  const credit = media.credit_html || [media.author, media.license].filter(Boolean).join(", ");
  return `<figure class="record-photo">
    <img src="${escapeHtml(media.thumb_url)}" loading="lazy" alt="${escapeHtml(media.shows || media.subject || "Lap record holder image")}">
    <figcaption>${credit}${media.commons_page ? ` <a href="${escapeHtml(media.commons_page)}" target="_blank" rel="noreferrer">via Wikimedia Commons</a>` : ""}</figcaption>
  </figure>`;
}

function lapRecordHtml(track) {
  return `${formatLapRecord(track.lap_record)}${mediaCreditHtml(track.media)}`;
}

function elevationLink(track) {
  if (!track.elev) return "";
  const href = `./track3d.html?id=${encodeURIComponent(track.id)}`;
  return `<a class="btn-3d" href="${href}">View 3D elevation</a>`;
}

function cornerChipLabel(corner) {
  const parts = [`T${corner.n}`];
  if (corner.name) parts.push(corner.name);
  if (!isBlank(corner.peak_g)) parts.push(`${formatMaybeNumber(corner.peak_g, 1)}g`);
  if (!isBlank(corner.apex_speed_kmh)) parts.push(`${formatMaybeNumber(corner.apex_speed_kmh)} km/h`);
  return parts.join(" ");
}

function cornersSection(track) {
  const data = track.corners_data;
  if (!data?.corners?.length && !data?.straights?.length) return "";
  const chips = (data.corners || []).map((corner) => {
    const label = cornerChipLabel(corner);
    const title = [label, corner.note].filter(Boolean).join(" - ");
    return `<span class="corner-chip" title="${escapeHtml(title)}">${escapeHtml(label)}${corner.note ? `<span class="sr-only"> - ${escapeHtml(corner.note)}</span>` : ""}</span>`;
  }).join("");
  const straights = (data.straights || []).map((straight) => {
    const facts = [];
    if (!isBlank(straight.length_m)) facts.push(`${formatValue(straight.length_m)} m`);
    if (!isBlank(straight.top_speed_kmh)) facts.push(`${formatValue(straight.top_speed_kmh, 1)} km/h speed trap`);
    const note = straight.note ? ` <span>${escapeHtml(straight.note)}</span>` : "";
    return `<li><strong>${escapeHtml(straight.name || "Straight")}</strong>${facts.length ? ` - ${facts.join(" - ")}` : ""}${note}</li>`;
  }).join("");
  return `<section class="detail-section corner-data">
    <h3>Numbered corners</h3>
    ${chips ? `<div class="corner-chip-list">${chips}</div>` : ""}
    ${straights ? `<h4>Straights</h4><ul class="straight-list">${straights}</ul>` : ""}
  </section>`;
}

function listItems(items) {
  if (!items || !items.length) return `<p>${dash}</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function sourceLinks(sources) {
  if (!sources || !sources.length) return `<p>${dash}</p>`;
  return `<ul class="sources">${sources.map((source) => `
    <li><a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || source.url)}</a></li>
  `).join("")}</ul>`;
}

function renderDetail(track) {
  const g = track.highest_g_corner || {};
  const oldest = track.oldest_section || {};
  const cross = track.cross_section || {};
  const gText = g.corner
    ? `${escapeHtml(g.corner)}${isBlank(g.peak_g) ? "" : `, ${formatValue(g.peak_g, 1)} g`}${g.note ? `<span>${escapeHtml(g.note)}</span>` : ""}`
    : dash;
  const oldestText = oldest.section
    ? `${escapeHtml(oldest.section)}${oldest.in_use_since ? ` <span>Since ${oldest.in_use_since}</span>` : ""}${oldest.note ? `<span>${escapeHtml(oldest.note)}</span>` : ""}`
    : dash;
  const crossText = [cross.camber_note, cross.surface_note, cross.performance_effect]
    .filter(Boolean)
    .map(escapeHtml)
    .join(" ");

  detailEl.innerHTML = `
    <header class="detail-hero">
      <div>
        <p>${escapeHtml(track.flag)} ${escapeHtml(track.country)} / ${escapeHtml(track.region || "")}</p>
        <h2 id="modal-title">${escapeHtml(track.name)}</h2>
        <div class="detail-badges">${statusBadge(track.status)}<span>${escapeHtml(track.circuit_type || "circuit")}</span><span>${escapeHtml(track.direction || "unknown")}</span></div>
        ${elevationLink(track)}
        ${worldInset(track)}
      </div>
      ${detailOutlineSvg(track)}
    </header>

    ${cornersSection(track)}
    <div class="media-grid">
      ${satelliteFigure(track)}
      <dl class="detail-stats">
        ${detailStat("Races span", racesSpanHtml(track))}
        ${detailStat("Top speed", `${formatValue(track.top_speed_kmh, 1)} km/h${track.top_speed_note ? `<span>${escapeHtml(track.top_speed_note)}</span>` : ""}`)}
        ${detailStat("Highest-g corner", gText)}
        ${detailStat("Oldest section still in use", oldestText)}
        ${detailStat("Lap record", lapRecordHtml(track))}
      </dl>
    </div>

    <section class="detail-section">
      <h3>Cross-section and performance effect</h3>
      <p>${crossText || dash}</p>
      ${isBlank(cross.banking_deg_max) ? "" : `<p class="fine">Maximum banking: ${formatValue(cross.banking_deg_max, 1)} degrees.</p>`}
    </section>
    <section class="detail-section">
      <h3>Layout variants</h3>
      ${listItems(track.layout_variants)}
    </section>
    <section class="detail-section">
      <h3>Notes</h3>
      <p>${track.notes ? escapeHtml(track.notes) : dash}</p>
    </section>
    <section class="detail-section">
      <h3>Sources</h3>
      ${sourceLinks(track.sources)}
    </section>
  `;
}

function announce(message) {
  const announcer = document.querySelector("#ticker-announcer");
  if (announcer) announcer.textContent = message;
}

function updateSatellite(track, figure) {
  const box = satelliteBox(track, state.satelliteZoom[track.id] ?? 1);
  if (!box) return;
  const img = figure.querySelector("img");
  const overlay = figure.querySelector(".satellite__overlay");
  const caption = figure.querySelector("figcaption");
  if (img) img.src = box.url;
  if (overlay) overlay.outerHTML = satelliteOverlay(track, box.bbox);
  if (caption) caption.textContent = `World Imagery context around the circuit coordinates. Zoom ${box.label}.`;
  announce(`Satellite zoom ${box.label}`);
}

function focusableElements() {
  return [...modal.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
}

function openDetail(id) {
  const track = tracks.find((item) => item.id === id);
  if (!track) return;
  state.lastFocus = document.activeElement;
  renderDetail(track);
  modal.hidden = false;
  document.body.classList.add("has-modal");
  const nodes = focusableElements();
  if (nodes.length) {
    nodes[0].focus();
  } else {
    modalPanel.focus();
  }
}

function closeDetail() {
  modal.hidden = true;
  document.body.classList.remove("has-modal");
  detailEl.innerHTML = "";
  if (state.lastFocus && typeof state.lastFocus.focus === "function") {
    state.lastFocus.focus();
  }
}

theadEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-sort]");
  if (!button) return;
  if (button.getAttribute("aria-disabled") === "true") return;
  setSort(button.dataset.sort);
});

searchEl.addEventListener("input", (event) => {
  state.query = event.target.value;
  renderTable();
});

document.querySelectorAll(".chip[data-status]").forEach((button) => {
  button.addEventListener("click", () => {
    state.status = button.dataset.status;
    document.querySelectorAll(".chip[data-status]").forEach((chip) => {
      const active = chip === button;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    renderTable();
  });
});

seasonToggle.addEventListener("click", () => {
  setView(state.view === "season" ? "atlas" : "season");
});

yearSelect.addEventListener("change", () => {
  state.seasonYear = yearSelect.value;
  renderTable();
});

rowsEl.addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (row) openDetail(row.dataset.id);
});

rowsEl.addEventListener("keydown", (event) => {
  const row = event.target.closest("tr[data-id]");
  if (!row) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openDetail(row.dataset.id);
  }
});

modal.addEventListener("click", (event) => {
  const disabledAction = event.target.closest("[aria-disabled='true']");
  if (disabledAction) {
    event.preventDefault();
    return;
  }
  const cornerToggle = event.target.closest("[data-corners-toggle]");
  if (cornerToggle) {
    const pressed = cornerToggle.getAttribute("aria-pressed") === "true";
    cornerToggle.setAttribute("aria-pressed", String(!pressed));
    cornerToggle.closest(".outline-detail")?.classList.toggle("corners-hidden", pressed);
    return;
  }
  const zoomButton = event.target.closest("[data-sat-zoom]");
  if (zoomButton) {
    const figure = zoomButton.closest("[data-satellite-track]");
    const track = tracks.find((item) => item.id === figure?.dataset.satelliteTrack);
    if (!track) return;
    const current = state.satelliteZoom[track.id] ?? 1;
    const action = zoomButton.dataset.satZoom;
    const next = action === "in"
      ? Math.min(satelliteZoomScales.length - 1, current + 1)
      : action === "out"
        ? Math.max(0, current - 1)
        : 1;
    state.satelliteZoom[track.id] = next;
    updateSatellite(track, figure);
    return;
  }
  if (event.target.closest(closeSelectors)) closeDetail();
});

modal.addEventListener("keydown", (event) => {
  const disabledAction = event.target.closest("[aria-disabled='true']");
  if (!disabledAction) return;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
  }
});

document.addEventListener("keydown", (event) => {
  if (modal.hidden) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeDetail();
    return;
  }
  if (event.key !== "Tab") return;
  const nodes = focusableElements();
  if (!nodes.length) return;
  const first = nodes[0];
  const last = nodes[nodes.length - 1];
  if (document.activeElement === modalPanel && event.shiftKey) {
    event.preventDefault();
    last.focus();
  } else if (document.activeElement === modalPanel) {
    event.preventDefault();
    first.focus();
  } else if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

function renderStats() {
  document.querySelector("#stat-circuits").textContent = tracks.length;
  document.querySelector("#stat-countries").textContent = new Set(tracks.map((track) => track.country)).size;
}

function syncControlsHeight() {
  const controls = document.querySelector(".controls");
  if (controls) {
    document.documentElement.style.setProperty("--controls-h", `${controls.offsetHeight}px`);
  }
}
new ResizeObserver(syncControlsHeight).observe(document.querySelector(".controls"));

populateSeasonYears();
renderStats();
updateSortHeaders();
renderTable();
syncControlsHeight();
