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
};

const rowsEl = document.querySelector("#track-rows");
const searchEl = document.querySelector("#search");
const countEl = document.querySelector("#result-count");
const modal = document.querySelector("#detail-modal");
const modalPanel = modal.querySelector(".modal__panel");
const detailEl = document.querySelector("#detail-content");
const closeSelectors = "[data-close]";
const dash = "—";

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

function outlineSvg(track, sizeClass = "outline-thumb") {
  if (!track.outline_d) {
    return `<span class="${sizeClass} outline-empty" aria-label="No outline available">${dash}</span>`;
  }
  return `<svg class="${sizeClass}" viewBox="0 0 1000 1000" role="img" aria-label="${escapeHtml(track.name)} track outline"><path d="${escapeHtml(track.outline_d)}" fill="none" stroke="currentColor" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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

function satelliteUrl(track) {
  const lat = track.location?.lat;
  const lon = track.location?.lon;
  if (typeof lat !== "number" || typeof lon !== "number") return "";
  const delta = Math.min(Math.max((Number(track.length_km) || 5) / 85, 0.025), 0.16);
  const bbox = [lon - delta, lat - delta, lon + delta, lat + delta].map((n) => n.toFixed(5)).join(",");
  return `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox=${bbox}&bboxSR=4326&size=800,500&format=jpg&f=image`;
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
  const sat = satelliteUrl(track);
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
        ${worldInset(track)}
      </div>
      ${outlineSvg(track, "outline-large")}
    </header>

    <div class="media-grid">
      <figure class="satellite">
        ${sat ? `<img src="${sat}" loading="lazy" alt="Satellite view of ${escapeHtml(track.name)} near ${escapeHtml(track.region || track.country)}">` : `<div class="image-fallback" role="img" aria-label="Satellite view unavailable">${dash}</div>`}
        <figcaption>World Imagery context around the circuit coordinates.</figcaption>
      </figure>
      <dl class="detail-stats">
        ${detailStat("Top speed", `${formatValue(track.top_speed_kmh, 1)} km/h${track.top_speed_note ? `<span>${escapeHtml(track.top_speed_note)}</span>` : ""}`)}
        ${detailStat("Highest-g corner", gText)}
        ${detailStat("Oldest section still in use", oldestText)}
        ${detailStat("Lap record", formatLapRecord(track.lap_record))}
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
  if (event.target.closest(closeSelectors)) closeDetail();
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
