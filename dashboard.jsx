const React = window.React;
const ReactDOM = window.ReactDOM;
const { TickerStrip, StatTile, StatusBadge, TrackOutline, WorldInset, CornerChip, SortableTable } = window.TrackfansUI;

// Countdown target: race start, Sun 26 Jul 2026, 15:00 CEST (13:00 UTC)
const RACE_TS = Date.UTC(2026, 6, 26, 13, 0, 0);

const DRIVERS = [
  { pos: 1,  driver: "Andrea Kimi Antonelli", team: "Mercedes",  points: 204, wins: 6 },
  { pos: 2,  driver: "Lewis Hamilton",        team: "Ferrari",   points: 159, wins: 1 },
  { pos: 3,  driver: "George Russell",         team: "Mercedes",  points: 154, wins: 2 },
  { pos: 4,  driver: "Charles Leclerc",        team: "Ferrari",   points: 126, wins: 1 },
  { pos: 5,  driver: "Lando Norris",           team: "McLaren",   points: 103, wins: 0 },
  { pos: 6,  driver: "Oscar Piastri",          team: "McLaren",   points: 92,  wins: 0 },
  { pos: 7,  driver: "Max Verstappen",         team: "Red Bull",  points: 91,  wins: 0 },
  { pos: 8,  driver: "Isack Hadjar",           team: "Red Bull",  points: 60,  wins: 0 },
  { pos: 9,  driver: "Pierre Gasly",           team: "Alpine",    points: 42,  wins: 0 },
  { pos: 10, driver: "Liam Lawson",            team: "RB",        points: 39,  wins: 0 },
];

const COLUMNS = [
  { key: "pos",     label: "Pos",     ariaLabel: "Sort by championship position", render: (r) => "P" + r.pos },
  { key: "driver",  label: "Driver",  ariaLabel: "Sort by driver name" },
  { key: "team",    label: "Team",    ariaLabel: "Sort by team" },
  { key: "points",  label: "Points",  ariaLabel: "Sort by points" },
  { key: "wins",    label: "Wins",    ariaLabel: "Sort by wins" },
];

function useCountdown(target) {
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = Math.max(0, target - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
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
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "driver" || key === "team" ? "asc" : "desc"); }
  };

  const countText = c.live
    ? <strong>LIGHTS OUT — LIVE NOW</strong>
    : <strong>IN {c.d}D {String(c.h).padStart(2,"0")}H {String(c.m).padStart(2,"0")}M {String(c.s).padStart(2,"0")}S</strong>;

  return (
    <React.Fragment>
      <TickerStrip
        hidden={tickerHidden}
        live={c.live}
        paused={paused}
        onPauseToggle={() => setPaused((p) => !p)}
        onDismiss={() => setTickerHidden(true)}
      >
        BELGIAN GRAND PRIX <span className="ticker__sep">—</span> ROUND 13{" "}
        <span className="ticker__sep">·</span> SUN, JUL 26 · 15:00 CEST{" "}
        <span className="ticker__sep">·</span> SPA-FRANCORCHAMPS{" "}
        <span className="ticker__sep">·</span> {countText}{" "}
        <span className="ticker__sep">·</span> TITLE FIGHT: ANTONELLI +45 HAMILTON
      </TickerStrip>

      <div className="page">
        <header className="masthead">
          <div>
            <p className="masthead__eyebrow">2026 FIA Formula 1 World Championship · Round 13</p>
            <h1>Belgian Grand&nbsp;Prix</h1>
            <div className="masthead__sub">
              <strong style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>Circuit de Spa-Francorchamps</strong>
              <StatusBadge status="current" />
            </div>
          </div>
          <div className="masthead__meta">
            Stavelot, Wallonia · Belgium<br />
            <strong>44 laps</strong> · 308.052 km<br />
            First GP <strong>1950</strong> · 20 grands prix here
          </div>
        </header>

        <dl className="hero-stats" aria-label="Circuit de Spa-Francorchamps key statistics" style={{ margin: "1.75rem 0 0" }}>
          <StatTile value="7.004" label="lap length km" />
          <StatTile value="106" label="elevation swing m" />
          <StatTile value="4.7" label="peak g · les combes" />
          <StatTile value="1:46.286" label="lap record" />
        </dl>

        <div className="grid-2">
          <div className="panel track-panel">
            <TrackOutline pathD={SPA_D} trackName="Circuit de Spa-Francorchamps" size="detail" />
          </div>
          <div className="panel">
            <p className="panel__label">Location</p>
            <WorldInset
              worldPathD={WORLD_LAND_PATH}
              lat={50.4372}
              lon={5.9714}
              label="Location: Spa-Francorchamps, Belgium"
            />
          </div>
        </div>

        <section className="section">
          <div className="section__head">
            <h2>Signature corners</h2>
            <span>Sector benchmarks</span>
          </div>
          <div className="corner-chip-list">
            <CornerChip number={3} name="Eau Rouge / Raidillon" peakG={4.5} apexSpeedKmh={305}
              note="Compression at the base then a blind uphill left-right, taken flat in modern machinery" />
            <CornerChip number={5} name="Les Combes" peakG={4.7} apexSpeedKmh={130}
              note="Hardest braking on the lap at the end of the Kemmel straight — the weekend's best overtaking spot" />
            <CornerChip number={17} name="Blanchimont" peakG={4.0} apexSpeedKmh={310}
              note="Near-flat high-speed left leading onto the run to the Bus Stop chicane" />
          </div>
        </section>

        <section className="section">
          <div className="section__head">
            <h2>Drivers' championship</h2>
            <span>Standings after Round 10</span>
          </div>
          <SortableTable
            title="Drivers' championship"
            resultCount="Standings after Round 10 · top 10 of 20 drivers"
            caption="Formula 1 drivers' championship standings, sortable by every visible column."
            columns={COLUMNS}
            rows={sortedRows}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            getRowKey={(r) => r.driver}
            getRowAriaLabel={(r) => `P${r.pos} ${r.driver}, ${r.points} points`}
          />
        </section>
      </div>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<Dashboard />);
