/*
 * trackfans race ticker — self-contained, vanilla JS.
 * One-glance "when is the next Grand Prix?" strip. Polls the open Jolpica
 * F1 API, renders an upcoming countdown / live-window banner, hides on
 * failure, and never spams assistive tech.
 */
(function () {
  "use strict";

  const STRIP = document.getElementById("race-ticker");
  if (!STRIP) return;
  const TEXT = document.getElementById("ticker-text");
  const DISMISS = document.getElementById("ticker-dismiss");
  if (!TEXT || !DISMISS) return;

  const DISMISS_KEY = "trackfans:ticker-dismissed";
  const POLL_MS = 600000;            // 10 minutes
  const COUNTDOWN_TICK_MS = 60000;   // countdown text updates once per minute
  const LIVE_PRE_MS = 30 * 60 * 1000;   // -30 min before session start
  const LIVE_POST_MS = 3 * 60 * 60 * 1000; // +3 h after session start

  const ENDPOINT_NEXT = "https://api.jolpi.ca/ergast/f1/current/next.json";
  const ENDPOINT_QUALI = "https://api.jolpi.ca/ergast/f1/current/last/qualifying.json";
  const ENDPOINT_STAND = "https://api.jolpi.ca/ergast/f1/current/driverStandings.json";
  const LIVE_LINK = "https://www.formula1.com/en/timing";

  // Test hook: set window.__TICKER_NOW to a fixed epoch ms to stub "now".
  const now = () =>
    typeof window === "object" && typeof window.__TICKER_NOW === "number"
      ? window.__TICKER_NOW
      : Date.now();

  const reduceMotion = () =>
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let pollTimer = null;
  let tickTimer = null;
  let nextRace = null;
  let qualiRace = null;
  let standings = null;
  let currentMode = null;     // "upcoming" | "live"
  let countdownEl = null;     // ref so we can update text without full re-render

  // --- safe helpers ---------------------------------------------------------

  function safe(obj, ...keys) {
    let cur = obj;
    for (const k of keys) {
      if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
      cur = cur[k];
    }
    return cur;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseUtc(date, time) {
    if (!date) return null;
    const t = time || "00:00:00Z";
    const iso = date + "T" + (t.endsWith("Z") ? t : t + "Z");
    const ms = Date.parse(iso);
    return Number.isNaN(ms) ? null : ms;
  }

  // --- formatting -----------------------------------------------------------

  let _dateFmt = null;
  let _timeFmt = null;
  function localDate(ms) {
    try {
      if (!_dateFmt) {
        _dateFmt = new Intl.DateTimeFormat(undefined, {
          weekday: "short", month: "short", day: "numeric",
        });
      }
      return _dateFmt.format(new Date(ms));
    } catch (e) {
      return new Date(ms).toUTCString();
    }
  }
  function localTime(ms) {
    // Visitor's wall-clock time + short timezone name (e.g. "3:00 PM EDT").
    try {
      if (!_timeFmt) {
        _timeFmt = new Intl.DateTimeFormat(undefined, {
          hour: "2-digit", minute: "2-digit", timeZoneName: "short",
        });
      }
      return _timeFmt.format(new Date(ms));
    } catch (e) {
      return new Date(ms).toUTCString();
    }
  }

  function formatCountdown(diff) {
    if (diff <= 0) return "now";
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d >= 1) return "in " + d + "d " + h + "h";
    if (h >= 1) return "in " + h + "h " + m + "m";
    return "in " + m + "m";
  }

  // --- state computation ----------------------------------------------------

  const SESSION_LABELS = [
    ["FirstPractice", "Practice 1"],
    ["SecondPractice", "Practice 2"],
    ["ThirdPractice", "Practice 3"],
    ["SprintQualifying", "Sprint Qualifying"],
    ["Sprint", "Sprint"],
    ["Qualifying", "Qualifying"],
    ["race", "Race"],
  ];

  function findLiveSession(race, nowMs) {
    if (!race) return null;
    for (const [key, label] of SESSION_LABELS) {
      const seg = key === "race" ? { date: race.date, time: race.time } : race[key];
      const start = parseUtc(safe(seg, "date"), safe(seg, "time"));
      if (start === null) continue;
      if (nowMs >= start - LIVE_PRE_MS && nowMs <= start + LIVE_POST_MS) {
        return { label, start };
      }
    }
    return null;
  }

  function subLine() {
    // Pole + P2/P3 if quali results belong to the next race's weekend;
    // otherwise championship top-3 surnames from standings.
    if (
      qualiRace &&
      nextRace &&
      String(safe(qualiRace, "season")) === String(safe(nextRace, "season")) &&
      String(safe(qualiRace, "round")) === String(safe(nextRace, "round"))
    ) {
      const results = safe(qualiRace, "QualifyingResults");
      if (Array.isArray(results)) {
        const top3 = results.slice(0, 3)
          .map((r) => safe(r, "Driver", "familyName"))
          .filter(Boolean);
        if (top3.length) {
          let s = "Pole: " + top3[0];
          if (top3[1]) s += " · P2: " + top3[1];
          if (top3[2]) s += " · P3: " + top3[2];
          return s;
        }
      }
    }
    const list = Array.isArray(standings) ? standings.slice(0, 3) : [];
    const names = list.map((d) => safe(d, "Driver", "familyName")).filter(Boolean);
    return names.length ? "Top 3: " + names.join(", ") : "";
  }

  // --- rendering ------------------------------------------------------------

  function setText(html, isLive) {
    TEXT.innerHTML = "";
    const track = document.createElement("span");
    track.className = "ticker__track";
    const seg1 = document.createElement("span");
    seg1.className = "ticker__seg";
    seg1.innerHTML = html;
    track.appendChild(seg1);
    // Duplicate for the marquee animation (only shown under the no-preference
    // + small-screen media query in CSS). aria-hidden + inert so it never
    // reaches AT or the keyboard.
    const seg2 = document.createElement("span");
    seg2.className = "ticker__seg";
    seg2.setAttribute("aria-hidden", "true");
    seg2.innerHTML = html;
    seg2.querySelectorAll("a,button").forEach((el) => el.setAttribute("tabindex", "-1"));
    track.appendChild(seg2);
    TEXT.appendChild(track);
    countdownEl = isLive ? null : TEXT.querySelector(".ticker__count");
  }

  function renderUpcoming() {
    const race = nextRace;
    const start = parseUtc(safe(race, "date"), safe(race, "time"));
    const name = safe(race, "raceName") || "Next Grand Prix";
    const when = start !== null ? localDate(start) : "";
    const tzone = start !== null ? localTime(start) : "";
    const cd = start !== null ? formatCountdown(start - now()) : "";
    const sub = subLine();
    let html =
      esc(name) +
      ' <span class="ticker__sep">—</span> ' +
      esc(when) +
      ' <span class="ticker__sep">·</span> ' +
      esc(tzone) +
      ' <span class="ticker__sep">·</span> ' +
      '<span class="ticker__count">' + esc(cd) + "</span>";
    if (sub) html += ' <span class="ticker__sep">·</span> <span class="ticker__sub">' + esc(sub) + "</span>";
    STRIP.classList.remove("is-live");
    setText(html, false);
  }

  function renderLive(label) {
    const html =
      '<a class="ticker__live-link" href="' + LIVE_LINK + '" target="_blank" rel="noopener">' +
      esc(label) + ' LIVE — follow at F1 live timing</a>';
    STRIP.classList.add("is-live");
    setText(html, true);
  }

  function render() {
    if (!nextRace) {
      hide();
      return;
    }
    if (sessionStorage.getItem(DISMISS_KEY) === "1") {
      hide();
      return;
    }
    const live = findLiveSession(nextRace, now());
    if (live) {
      currentMode = "live";
      renderLive(live.label);
    } else {
      currentMode = "upcoming";
      renderUpcoming();
    }
    show();
  }

  // once-per-minute countdown refresh — text only, no DOM rebuild, so the
  // marquee animation never restarts and aria-live stays silent.
  function tick() {
    if (!nextRace) return;
    const live = findLiveSession(nextRace, now());
    if (live && currentMode !== "live") { render(); return; }
    if (!live && currentMode === "live") { render(); return; }
    if (currentMode === "upcoming" && countdownEl) {
      const start = parseUtc(safe(nextRace, "date"), safe(nextRace, "time"));
      if (start !== null) countdownEl.textContent = formatCountdown(start - now());
    }
  }

  function show() { if (STRIP.hasAttribute("hidden")) STRIP.removeAttribute("hidden"); }
  function hide() { if (!STRIP.hasAttribute("hidden")) STRIP.setAttribute("hidden", ""); }

  // --- data -----------------------------------------------------------------

  async function fetchJson(url) {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  }

  async function poll() {
    let nxt;
    try {
      const data = await fetchJson(ENDPOINT_NEXT);
      nxt = safe(data, "MRData", "RaceTable", "Races", 0);
      if (!nxt || !safe(nxt, "date")) throw new Error("no next race");
    } catch (e) {
      // FAILURE: never render a broken banner; retry silently next poll.
      hide();
      return;
    }
    nextRace = nxt;

    // Best-effort fallback data — never let these hide an otherwise good strip.
    try {
      const q = await fetchJson(ENDPOINT_QUALI);
      qualiRace = safe(q, "MRData", "RaceTable", "Races", 0) || null;
    } catch (e) { qualiRace = null; }
    try {
      const s = await fetchJson(ENDPOINT_STAND);
      standings = safe(s, "MRData", "StandingsTable", "StandingsLists", 0, "DriverStandings") || null;
    } catch (e) { standings = null; }

    render();
  }

  // --- lifecycle -----------------------------------------------------------

  function startTimers() {
    stopTimers();
    pollTimer = setInterval(poll, POLL_MS);
    tickTimer = setInterval(tick, COUNTDOWN_TICK_MS);
  }
  function stopTimers() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  }

  function onVisibility() {
    if (!document.hidden) poll();
  }

  function onDismiss() {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch (e) {}
    stopTimers();
    hide();
  }

  function init() {
    if (sessionStorage.getItem(DISMISS_KEY) === "1") {
      // Stay hidden for the session; do nothing else.
      return;
    }
    DISMISS.addEventListener("click", onDismiss);
    document.addEventListener("visibilitychange", onVisibility);
    startTimers();
    poll();
  }

  // reduced-motion users: the global stylesheet already zeroes animations,
  // so nothing dynamic to do here; we just avoid any JS-driven motion.
  void reduceMotion;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  // expose for debugging / stubbing "now"
  window.__TICKER__ = { poll: poll, render: render, setNow: (ms) => { window.__TICKER_NOW = ms; } };
})();
