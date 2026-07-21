(() => {
  // site/dashboard.jsx
  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var { TickerStrip, StatTile, StatusBadge, TrackOutline, WorldInset, CornerChip, SortableTable } = window.TrackfansUI;
  var RACE_TS = Date.UTC(2026, 6, 26, 13, 0, 0);
  var DRIVERS = [
    { pos: 1, driver: "Andrea Kimi Antonelli", team: "Mercedes", points: 204, wins: 6 },
    { pos: 2, driver: "Lewis Hamilton", team: "Ferrari", points: 159, wins: 1 },
    { pos: 3, driver: "George Russell", team: "Mercedes", points: 154, wins: 2 },
    { pos: 4, driver: "Charles Leclerc", team: "Ferrari", points: 126, wins: 1 },
    { pos: 5, driver: "Lando Norris", team: "McLaren", points: 103, wins: 0 },
    { pos: 6, driver: "Oscar Piastri", team: "McLaren", points: 92, wins: 0 },
    { pos: 7, driver: "Max Verstappen", team: "Red Bull", points: 91, wins: 0 },
    { pos: 8, driver: "Isack Hadjar", team: "Red Bull", points: 60, wins: 0 },
    { pos: 9, driver: "Pierre Gasly", team: "Alpine", points: 42, wins: 0 },
    { pos: 10, driver: "Liam Lawson", team: "RB", points: 39, wins: 0 }
  ];
  var COLUMNS = [
    { key: "pos", label: "Pos", ariaLabel: "Sort by championship position", render: (r) => "P" + r.pos },
    { key: "driver", label: "Driver", ariaLabel: "Sort by driver name" },
    { key: "team", label: "Team", ariaLabel: "Sort by team" },
    { key: "points", label: "Points", ariaLabel: "Sort by points" },
    { key: "wins", label: "Wins", ariaLabel: "Sort by wins" }
  ];
  function useCountdown(target) {
    const [now, setNow] = React.useState(Date.now());
    React.useEffect(() => {
      const id = setInterval(() => setNow(Date.now()), 1e3);
      return () => clearInterval(id);
    }, []);
    const diff = Math.max(0, target - now);
    const d = Math.floor(diff / 864e5);
    const h = Math.floor(diff % 864e5 / 36e5);
    const m = Math.floor(diff % 36e5 / 6e4);
    const s = Math.floor(diff % 6e4 / 1e3);
    return { d, h, m, s, live: diff === 0 };
  }
  function Dashboard() {
    const [tickerHidden, setTickerHidden] = React.useState(false);
    const [paused, setPaused] = React.useState(false);
    const [sortKey, setSortKey] = React.useState("points");
    const [sortDir, setSortDir] = React.useState("desc");
    const c = useCountdown(RACE_TS);
    const sortedRows = React.useMemo(() => {
      const dir = sortDir === "asc" ? 1 : -1;
      return [...DRIVERS].sort((a, b) => {
        const av = a[sortKey], bv = b[sortKey];
        if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
        return String(av).localeCompare(String(bv)) * dir;
      });
    }, [sortKey, sortDir]);
    const onSort = (key) => {
      if (key === sortKey) setSortDir((d) => d === "asc" ? "desc" : "asc");
      else {
        setSortKey(key);
        setSortDir(key === "driver" || key === "team" ? "asc" : "desc");
      }
    };
    const countText = c.live ? /* @__PURE__ */ React.createElement("strong", null, "LIGHTS OUT \u2014 LIVE NOW") : /* @__PURE__ */ React.createElement("strong", null, "IN ", c.d, "D ", String(c.h).padStart(2, "0"), "H ", String(c.m).padStart(2, "0"), "M ", String(c.s).padStart(2, "0"), "S");
    return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
      TickerStrip,
      {
        hidden: tickerHidden,
        live: c.live,
        paused,
        onPauseToggle: () => setPaused((p) => !p),
        onDismiss: () => setTickerHidden(true)
      },
      "BELGIAN GRAND PRIX ",
      /* @__PURE__ */ React.createElement("span", { className: "ticker__sep" }, "\u2014"),
      " ROUND 13",
      " ",
      /* @__PURE__ */ React.createElement("span", { className: "ticker__sep" }, "\xB7"),
      " SUN, JUL 26 \xB7 15:00 CEST",
      " ",
      /* @__PURE__ */ React.createElement("span", { className: "ticker__sep" }, "\xB7"),
      " SPA-FRANCORCHAMPS",
      " ",
      /* @__PURE__ */ React.createElement("span", { className: "ticker__sep" }, "\xB7"),
      " ",
      countText,
      " ",
      /* @__PURE__ */ React.createElement("span", { className: "ticker__sep" }, "\xB7"),
      " TITLE FIGHT: ANTONELLI +45 HAMILTON"
    ), /* @__PURE__ */ React.createElement("div", { className: "page" }, /* @__PURE__ */ React.createElement("header", { className: "masthead" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("p", { className: "masthead__eyebrow" }, "2026 FIA Formula 1 World Championship \xB7 Round 13"), /* @__PURE__ */ React.createElement("h1", null, "Belgian Grand\xA0Prix"), /* @__PURE__ */ React.createElement("div", { className: "masthead__sub" }, /* @__PURE__ */ React.createElement("strong", { style: { fontFamily: "var(--font-display)", color: "var(--ink)" } }, "Circuit de Spa-Francorchamps"), /* @__PURE__ */ React.createElement(StatusBadge, { status: "current" }))), /* @__PURE__ */ React.createElement("div", { className: "masthead__meta" }, "Stavelot, Wallonia \xB7 Belgium", /* @__PURE__ */ React.createElement("br", null), /* @__PURE__ */ React.createElement("strong", null, "44 laps"), " \xB7 308.052 km", /* @__PURE__ */ React.createElement("br", null), "First GP ", /* @__PURE__ */ React.createElement("strong", null, "1950"), " \xB7 20 grands prix here")), /* @__PURE__ */ React.createElement("dl", { className: "hero-stats", "aria-label": "Circuit de Spa-Francorchamps key statistics", style: { margin: "1.75rem 0 0" } }, /* @__PURE__ */ React.createElement(StatTile, { value: "7.004", label: "lap length km" }), /* @__PURE__ */ React.createElement(StatTile, { value: "106", label: "elevation swing m" }), /* @__PURE__ */ React.createElement(StatTile, { value: "4.7", label: "peak g \xB7 les combes" }), /* @__PURE__ */ React.createElement(StatTile, { value: "1:46.286", label: "lap record" })), /* @__PURE__ */ React.createElement("div", { className: "grid-2" }, /* @__PURE__ */ React.createElement("div", { className: "panel track-panel" }, /* @__PURE__ */ React.createElement(TrackOutline, { pathD: SPA_D, trackName: "Circuit de Spa-Francorchamps", size: "detail" })), /* @__PURE__ */ React.createElement("div", { className: "panel" }, /* @__PURE__ */ React.createElement("p", { className: "panel__label" }, "Location"), /* @__PURE__ */ React.createElement(
      WorldInset,
      {
        worldPathD: WORLD_LAND_PATH,
        lat: 50.4372,
        lon: 5.9714,
        label: "Location: Spa-Francorchamps, Belgium"
      }
    ))), /* @__PURE__ */ React.createElement("section", { className: "section" }, /* @__PURE__ */ React.createElement("div", { className: "section__head" }, /* @__PURE__ */ React.createElement("h2", null, "Signature corners"), /* @__PURE__ */ React.createElement("span", null, "Sector benchmarks")), /* @__PURE__ */ React.createElement("div", { className: "corner-chip-list" }, /* @__PURE__ */ React.createElement(
      CornerChip,
      {
        number: 3,
        name: "Eau Rouge / Raidillon",
        peakG: 4.5,
        apexSpeedKmh: 305,
        note: "Compression at the base then a blind uphill left-right, taken flat in modern machinery"
      }
    ), /* @__PURE__ */ React.createElement(
      CornerChip,
      {
        number: 5,
        name: "Les Combes",
        peakG: 4.7,
        apexSpeedKmh: 130,
        note: "Hardest braking on the lap at the end of the Kemmel straight \u2014 the weekend's best overtaking spot"
      }
    ), /* @__PURE__ */ React.createElement(
      CornerChip,
      {
        number: 17,
        name: "Blanchimont",
        peakG: 4,
        apexSpeedKmh: 310,
        note: "Near-flat high-speed left leading onto the run to the Bus Stop chicane"
      }
    ))), /* @__PURE__ */ React.createElement("section", { className: "section" }, /* @__PURE__ */ React.createElement("div", { className: "section__head" }, /* @__PURE__ */ React.createElement("h2", null, "Drivers' championship"), /* @__PURE__ */ React.createElement("span", null, "Standings after Round 10")), /* @__PURE__ */ React.createElement(
      SortableTable,
      {
        title: "Drivers' championship",
        resultCount: "Standings after Round 10 \xB7 top 10 of 20 drivers",
        caption: "Formula 1 drivers' championship standings, sortable by every visible column.",
        columns: COLUMNS,
        rows: sortedRows,
        sortKey,
        sortDir,
        onSort,
        getRowKey: (r) => r.driver,
        getRowAriaLabel: (r) => `P${r.pos} ${r.driver}, ${r.points} points`
      }
    ))));
  }
  ReactDOM.createRoot(document.getElementById("root")).render(/* @__PURE__ */ React.createElement(Dashboard, null));
})();
