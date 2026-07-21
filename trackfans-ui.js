var TrackfansUI = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // .dashboard-build-1c4Yhy/trackfans-ui-entry.ts
  var trackfans_ui_entry_exports = {};
  __export(trackfans_ui_entry_exports, {
    CornerChip: () => CornerChip,
    DetailPanel: () => DetailPanel,
    ElevationLegend: () => ElevationLegend,
    FilterChip: () => FilterChip,
    SeriesNav: () => SeriesNav,
    SortableTable: () => SortableTable,
    StatTile: () => StatTile,
    StatusBadge: () => StatusBadge,
    TickerStrip: () => TickerStrip,
    TrackOutline: () => TrackOutline,
    VersionBadge: () => VersionBadge,
    WorldInset: () => WorldInset
  });

  // ui/src/components/CornerChip/index.tsx
  function isBlank(value) {
    return value === null || value === void 0 || value === "";
  }
  function formatNumber(value, digits = 0) {
    if (typeof value === "number") {
      return new Intl.NumberFormat("en-US", {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits
      }).format(value);
    }
    return value;
  }
  function cornerChipLabel({ number, name, peakG, apexSpeedKmh }) {
    const parts = [`T${number}`];
    if (!isBlank(name)) parts.push(String(name));
    if (!isBlank(peakG)) parts.push(`${formatNumber(peakG, 1)}g`);
    if (!isBlank(apexSpeedKmh)) parts.push(`${formatNumber(apexSpeedKmh)} km/h`);
    return parts.join(" ");
  }
  function CornerChip(props) {
    const label = cornerChipLabel(props);
    const title = [label, props.note].filter(Boolean).join(" - ");
    return /* @__PURE__ */ React.createElement("span", { className: "corner-chip", title }, label, props.note ? /* @__PURE__ */ React.createElement("span", { className: "sr-only" }, " - ", props.note) : null);
  }

  // ui/src/components/DetailPanel/index.tsx
  var dash = "\u2014";
  function DetailPanel({ label, value, note }) {
    return /* @__PURE__ */ React.createElement("div", { className: "detail-stat" }, /* @__PURE__ */ React.createElement("dt", null, label), /* @__PURE__ */ React.createElement("dd", null, /* @__PURE__ */ React.createElement("strong", null, value ?? dash), note ? /* @__PURE__ */ React.createElement("span", null, note) : null));
  }

  // ui/src/components/ElevationLegend/index.tsx
  var dash2 = "\u2014";
  function ElevationLegend({
    min,
    max,
    swing,
    vertical = "x3",
    sources = "Data sources: OpenTopoData SRTM / OSM",
    helpExpanded = false,
    helpText
  }) {
    return /* @__PURE__ */ React.createElement("aside", { id: "legend", className: "legend", "aria-live": "polite" }, /* @__PURE__ */ React.createElement("div", { className: "legend__top" }, /* @__PURE__ */ React.createElement("h2", null, "Elevation"), /* @__PURE__ */ React.createElement("button", { id: "help-toggle", className: "help-toggle", type: "button", "aria-expanded": helpExpanded, "aria-controls": "help-panel" }, "?")), /* @__PURE__ */ React.createElement("dl", { className: "legend-grid" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Min"), /* @__PURE__ */ React.createElement("dd", null, min ?? dash2)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Max"), /* @__PURE__ */ React.createElement("dd", null, max ?? dash2)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Swing"), /* @__PURE__ */ React.createElement("dd", null, swing ?? dash2)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", null, "Vertical"), /* @__PURE__ */ React.createElement("dd", null, vertical ?? dash2))), sources ? /* @__PURE__ */ React.createElement("p", { className: "sources" }, sources) : null, helpText ? /* @__PURE__ */ React.createElement("div", { id: "help-panel", className: "help-panel", hidden: !helpExpanded }, /* @__PURE__ */ React.createElement("p", null, helpText)) : null);
  }

  // ui/src/components/FilterChip/index.tsx
  function FilterChip({ children, isActive = false, ariaLabel, ...buttonProps }) {
    return /* @__PURE__ */ React.createElement(
      "button",
      {
        ...buttonProps,
        className: `chip${isActive ? " is-active" : ""}`,
        type: "button",
        "aria-label": ariaLabel,
        "aria-pressed": isActive
      },
      children
    );
  }

  // ui/src/components/SeriesNav/index.tsx
  function SeriesNav({
    brand,
    brandHref,
    links,
    ariaLabel = "Racing series"
  }) {
    return /* @__PURE__ */ React.createElement("nav", { className: "series-nav", "aria-label": ariaLabel }, /* @__PURE__ */ React.createElement("div", { className: "series-nav__inner" }, /* @__PURE__ */ React.createElement("a", { className: "series-nav__brand", href: brandHref }, brand), links.map((link) => /* @__PURE__ */ React.createElement(
      "a",
      {
        className: "series-nav__link",
        href: link.href,
        "aria-current": link.current ? "page" : void 0,
        key: `${link.href}:${link.label}`
      },
      link.label
    ))));
  }

  // ui/src/components/SortableTable/index.tsx
  function displayValue(value) {
    return value === null || value === void 0 || value === "" ? "\u2014" : value;
  }
  function SortableTable({
    title,
    resultCount,
    caption,
    columns,
    rows,
    sortKey,
    sortDir,
    onSort,
    getRowKey,
    getRowAriaLabel,
    onRowClick
  }) {
    return /* @__PURE__ */ React.createElement("section", { className: "table-shell", "aria-labelledby": "table-title" }, /* @__PURE__ */ React.createElement("div", { className: "table-head" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("h2", { id: "table-title" }, title), /* @__PURE__ */ React.createElement("p", { id: "result-count", "aria-live": "polite" }, resultCount))), /* @__PURE__ */ React.createElement("div", { className: "table-scroll" }, /* @__PURE__ */ React.createElement("table", null, /* @__PURE__ */ React.createElement("caption", null, caption), /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, columns.map((column) => {
      const active = column.key === sortKey;
      return /* @__PURE__ */ React.createElement(
        "th",
        {
          scope: "col",
          "aria-sort": active ? sortDir === "asc" ? "ascending" : "descending" : void 0,
          key: column.key
        },
        /* @__PURE__ */ React.createElement(
          "button",
          {
            type: "button",
            "data-sort": column.key,
            "aria-label": column.ariaLabel,
            onClick: () => onSort(column.key)
          },
          column.label,
          " ",
          /* @__PURE__ */ React.createElement("span", { "aria-hidden": "true" }, active ? sortDir === "asc" ? "\u25B2" : "\u25BC" : "")
        )
      );
    }))), /* @__PURE__ */ React.createElement("tbody", null, rows.map((row, rowIndex) => /* @__PURE__ */ React.createElement(
      "tr",
      {
        tabIndex: onRowClick ? 0 : void 0,
        role: onRowClick ? "button" : void 0,
        "aria-label": getRowAriaLabel?.(row),
        onClick: onRowClick ? () => onRowClick(row) : void 0,
        key: getRowKey(row, rowIndex)
      },
      columns.map((column) => /* @__PURE__ */ React.createElement("td", { "data-label": column.dataLabel ?? column.label, key: column.key }, displayValue(column.render ? column.render(row) : row[column.key])))
    ))))));
  }

  // ui/src/components/StatTile/index.tsx
  function StatTile({ value, label, valueId }) {
    return /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("dt", { id: valueId }, value), /* @__PURE__ */ React.createElement("dd", null, label));
  }

  // ui/src/components/StatusBadge/index.tsx
  function statusLabel(status) {
    return status === "current" ? "Current" : status === "future" ? "Future" : "Historical";
  }
  function StatusBadge({ status }) {
    if (!status) return null;
    return /* @__PURE__ */ React.createElement("span", { className: `badge badge--${status}` }, statusLabel(status));
  }

  // ui/src/components/TickerStrip/index.tsx
  function TickerStrip({
    children,
    hidden,
    live,
    paused,
    onPauseToggle,
    onDismiss,
    pauseLabel = "Pause race ticker",
    dismissLabel = "Dismiss race ticker"
  }) {
    const className = ["ticker", live ? "is-live" : "", paused ? "is-paused" : ""].filter(Boolean).join(" ");
    return /* @__PURE__ */ React.createElement("div", { className, role: "status", "aria-live": "off", hidden }, /* @__PURE__ */ React.createElement("div", { className: "ticker__inner" }, /* @__PURE__ */ React.createElement("span", { className: "ticker__dot", "aria-hidden": "true" }), /* @__PURE__ */ React.createElement("span", { className: "ticker__text" }, /* @__PURE__ */ React.createElement("span", { className: "ticker__track" }, /* @__PURE__ */ React.createElement("span", { className: "ticker__seg" }, children), /* @__PURE__ */ React.createElement("span", { className: "ticker__seg", "aria-hidden": "true" }, children))), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "ticker__pause",
        type: "button",
        "aria-pressed": paused ? "true" : "false",
        "aria-label": pauseLabel,
        onClick: onPauseToggle
      },
      "\u275A\u275A"
    ), /* @__PURE__ */ React.createElement("button", { className: "ticker__close", type: "button", "aria-label": dismissLabel, onClick: onDismiss }, "\xD7")));
  }

  // ui/src/components/TrackOutline/index.tsx
  var dash3 = "\u2014";
  function TrackOutline({ pathD, trackName, size = "thumb" }) {
    const sizeClass = size === "detail" ? "outline-large" : "outline-thumb";
    if (!pathD) {
      return /* @__PURE__ */ React.createElement("span", { className: `${sizeClass} outline-empty`, "aria-label": "No outline available" }, dash3);
    }
    return /* @__PURE__ */ React.createElement("svg", { className: sizeClass, viewBox: "0 0 1000 1000", role: "img", "aria-label": `${trackName} track outline` }, /* @__PURE__ */ React.createElement(
      "path",
      {
        d: pathD,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: "18",
        strokeLinecap: "round",
        strokeLinejoin: "round"
      }
    ));
  }

  // ui/src/components/VersionBadge/index.tsx
  function VersionBadge({ children }) {
    return /* @__PURE__ */ React.createElement("span", { className: "version-badge" }, children);
  }

  // ui/src/components/WorldInset/index.tsx
  function WorldInset({ worldPathD, lat, lon, label = "Location" }) {
    const hasLocation = typeof lat === "number" && typeof lon === "number";
    const cx = hasLocation ? (lon + 180) / 360 * 1e3 : 0;
    const cy = hasLocation ? (90 - lat) / 180 * 500 : 0;
    return /* @__PURE__ */ React.createElement("svg", { className: "world-inset", viewBox: "0 0 1000 500", role: "img", "aria-label": label }, /* @__PURE__ */ React.createElement("path", { d: worldPathD, className: "world-inset__land" }), hasLocation ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("circle", { className: "world-inset__pulse", cx, cy, r: "15" }), /* @__PURE__ */ React.createElement("circle", { className: "world-inset__dot", cx, cy, r: "7" })) : null);
  }
  return __toCommonJS(trackfans_ui_entry_exports);
})();
