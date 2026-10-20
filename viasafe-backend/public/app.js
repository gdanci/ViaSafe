(() => {
  "use strict";

  /* ---------- Constants ---------- */

  const CLUJ_CENTER = [46.7712, 23.6236];
  // ViaSafe covers Cluj-Napoca only: [south-west, north-east] as [lat, lng].
  const CLUJ_BOUNDS = [[46.70, 23.45], [46.85, 23.78]];
  const PIN_TTL_MS = 2 * 60 * 60 * 1000;
  const MAX_AVOID = 25;

  // Same colours and sizes as the ViaSafe Android app's safety-zone map.
  const LEVELS = {
    SAFE: { label: "Safe", color: "#4caf50", fill: 0.14, radius: 520 },
    CAUTION: { label: "Take care", color: "#fbc02d", fill: 0.24, radius: 610 },
    WARNING: { label: "Be alert", color: "#f57c00", fill: 0.28, radius: 700 },
    DANGER: { label: "Avoid if you can", color: "#d32f2f", fill: 0.32, radius: 790 }
  };

  /* ---------- State ---------- */

  const state = {
    areas: [],
    zones: [],
    reports: [],
    points: { from: null, to: null, report: null },
    pick: null
  };

  const $ = (id) => document.getElementById(id);
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  };

  /* ---------- Map ---------- */

  const map = L.map("map", {
    zoomControl: false,
    attributionControl: true,
    minZoom: 11,
    maxBounds: CLUJ_BOUNDS,
    maxBoundsViscosity: 1.0
  }).setView(CLUJ_CENTER, 13);
  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);

  map.fitBounds(CLUJ_BOUNDS);

  const areaLayer = L.layerGroup().addTo(map);
  const reportLayer = L.layerGroup().addTo(map);
  const routeLayer = L.layerGroup().addTo(map);
  const pointLayer = L.layerGroup().addTo(map);

  /* ---------- Helpers ---------- */

  const TYPE_LABELS = {
    "pin-harassment": "Harassment",
    "pin-suspicious": "Suspicious group",
    "pin-lighting": "Poor lighting",
    "pin-isolated": "Isolated area",
    "pin-other": "Other"
  };

  function categoryLabel(value) {
    return TYPE_LABELS[typeClass(value)];
  }

  function inCluj(p) {
    return p.lat >= CLUJ_BOUNDS[0][0] && p.lat <= CLUJ_BOUNDS[1][0] &&
      p.lng >= CLUJ_BOUNDS[0][1] && p.lng <= CLUJ_BOUNDS[1][1];
  }

  function typeClass(category) {
    const c = String(category || "").toLowerCase();
    if (c.includes("harass")) return "pin-harassment";
    if (c.includes("suspicious") || c.includes("danger")) return "pin-suspicious";
    if (c.includes("light")) return "pin-lighting";
    if (c.includes("isolat")) return "pin-isolated";
    return "pin-other";
  }

  function isPinType(category) {
    const c = String(category || "").toLowerCase();
    return ["suspicious", "harassment", "danger", "lighting", "isolated"].some((k) => c.includes(k));
  }

  // Demo reports imported from the seed data with no real category ("Reported concern") say nothing useful, so they are hidden.
  // Real reports from people, and imported ones with a real category, are kept.
  function isPlaceholderReport(r) {
    return /^imported demo report/i.test(String(r.description || "")) && !isPinType(r.category);
  }
  function isActivePin(report) {
    if (!isPinType(report.category)) return false;
    const t = Date.parse(report.createdAt);
    return Number.isNaN(t) || Date.now() - t <= PIN_TTL_MS;
  }

  function ago(iso, fallback) {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return fallback || "recently";
    const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (mins < 2) return "just now";
    if (mins < 60) return `${mins} min ago`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h ago`;
    return `${Math.round(hours / 24)} d ago`;
  }

  let toastTimer;
  function toast(message) {
    const node = $("toast");
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { node.hidden = true; }, 3500);
  }

  function showNotice(message, retry) {
    const node = $("notice");
    node.textContent = message;
    if (retry) {
      const b = el("button", null, "Try again");
      b.type = "button";
      b.addEventListener("click", retry);
      node.appendChild(b);
    }
    node.hidden = false;
  }
  function clearNotice() { $("notice").hidden = true; }

  async function api(path, options) {
    const res = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options && options.headers) }
    });
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = new Error((data && (data.error || data.message)) || `Request failed (${res.status})`);
      err.data = data;
      throw err;
    }
    return data;
  }

  /* ---------- Tabs ---------- */

  const tabs = Array.from(document.querySelectorAll(".tab"));

  function showTab(name) {
    tabs.forEach((t) => {
      const on = t.dataset.tab === name;
      t.classList.toggle("is-active", on);
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      $("view-" + t.dataset.tab).hidden = !on;
    });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => { cancelPick(); showTab(tab.dataset.tab); expandSheet(); });
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      next.focus();
      next.click();
    });
  });

  /* ---------- Mobile sheet ---------- */

  const panel = $("panel");
  function expandSheet() { panel.classList.remove("is-collapsed"); $("sheetHandle").setAttribute("aria-expanded", "true"); }
  function collapseSheet() { panel.classList.add("is-collapsed"); $("sheetHandle").setAttribute("aria-expanded", "false"); }
  $("sheetHandle").addEventListener("click", () => {
    panel.classList.contains("is-collapsed") ? expandSheet() : collapseSheet();
    setTimeout(() => map.invalidateSize(), 300);
  });

  /* ---------- Risk areas ---------- */

  // Neighbourhoods (cartiere): one zone per cartier instead of one circle per data point.
  const SCORE = { SAFE: 0, CAUTION: 1, WARNING: 2, DANGER: 3 };
  const LEVEL_BY_SCORE = ["SAFE", "CAUTION", "WARNING", "DANGER"];
  const MAX_POINT_DISTANCE = 2500; // metres: a point further than this from every cartier is ignored

  // Local flat projection (metres) around Cluj; accurate enough at city scale.
  const M_LAT = 110574;
  const M_LNG = 111320 * Math.cos((CLUJ_CENTER[0] * Math.PI) / 180);
  const toXY = (lat, lng) => [(lng - CLUJ_CENTER[1]) * M_LNG, (lat - CLUJ_CENTER[0]) * M_LAT];
  const toLatLng = ([x, y]) => [CLUJ_CENTER[0] + y / M_LAT, CLUJ_CENTER[1] + x / M_LNG];

  // Keep the part of a polygon on the "a" side of the line between a and b (the half closer to a).
  function clipCloser(poly, a, b) {
    const nx = b[0] - a[0], ny = b[1] - a[1];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const side = (p) => (p[0] - mx) * nx + (p[1] - my) * ny; // < 0 means closer to a
    const out = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length];
      const sp = side(p), sq = side(q);
      if (sp <= 0) out.push(p);
      if ((sp < 0 && sq > 0) || (sp > 0 && sq < 0)) {
        const t = sp / (sp - sq);
        out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
      }
    }
    return out;
  }

  // Non-overlapping zones: each cartier is a circle of its reach, trimmed so that
  // neighbouring cartiere share a border instead of overlapping.
  function buildZones(cartiere) {
    const centres = cartiere.map((c) => toXY(c.lat, c.lng));
    return cartiere.map((c, i) => {
      let poly = [];
      for (let k = 0; k < 40; k++) {
        const ang = (k / 40) * 2 * Math.PI;
        poly.push([centres[i][0] + Math.cos(ang) * c.reach, centres[i][1] + Math.sin(ang) * c.reach]);
      }
      for (let j = 0; j < cartiere.length && poly.length > 2; j++) {
        if (j !== i) poly = clipCloser(poly, centres[i], centres[j]);
      }
      return { ...c, latlngs: poly.map(toLatLng), points: [] };
    });
  }

  // One level per cartier from the points inside it: mostly the average, pulled up by the worst point.
  function levelFor(points) {
    const scores = points.map((p) => SCORE[p.safetyLevel] ?? 1);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const score = 0.6 * mean + 0.4 * Math.max(...scores);
    return LEVEL_BY_SCORE[score < 0.75 ? 0 : score < 1.5 ? 1 : score < 2.25 ? 2 : 3];
  }

  function nearestZone(zones, lat, lng) {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const [x, y] = toXY(lat, lng);
    let best = null, bestD = Infinity;
    zones.forEach((z) => {
      const [zx, zy] = toXY(z.lat, z.lng);
      const d = Math.hypot(x - zx, y - zy);
      if (d < bestD) { bestD = d; best = z; }
    });
    return best && bestD <= MAX_POINT_DISTANCE ? best : null;
  }

  const REPORT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
  function isRecentConcern(r) {
    if (!isPinType(r.category)) return false;
    const t = Date.parse(r.createdAt);
    return Number.isNaN(t) || Date.now() - t <= REPORT_WINDOW_MS;
  }

  function drawZones() {
    const zones = state.zones;
    zones.forEach((z) => { z.points = []; z.reports = []; });
    state.areas.forEach((a) => { const z = nearestZone(zones, a.latitude, a.longitude); if (z) z.points.push(a); });
    state.reports.filter(isRecentConcern).forEach((r) => { const z = nearestZone(zones, r.latitude, r.longitude); if (z) z.reports.push(r); });

    zones.forEach((z) => {
      // 1) base level: mapped data if there is any, otherwise the demo rating
      let base = null, night = false, source = "";
      if (z.points.length) {
        base = SCORE[levelFor(z.points)];
        night = z.points.filter((p) => p.isNightSensitive).length * 2 >= z.points.length;
        source = `Based on ${z.points.length} mapped ${z.points.length === 1 ? "spot" : "spots"}`;
      } else if (z.demo) {
        base = SCORE[z.demo];
        night = Boolean(z.demoNight);
        source = "Demo rating (placeholder until real data arrives)";
      }
      // 2) community reports from the last 7 days raise the level
      const n = z.reports.length;
      const bump = n >= 5 ? 2 : n >= 2 ? 1 : 0;
      const has = base !== null || n > 0;
      const score = Math.min(3, (base ?? 0) + bump);
      const key = has ? LEVEL_BY_SCORE[score] : null;
      const level = key ? LEVELS[key] : null;
      z.safetyLevel = key;

      const poly = L.polygon(z.latlngs, has
        ? { color: level.color, weight: night ? 2.5 : 1.5, dashArray: night ? "6 6" : null, fillColor: level.color, fillOpacity: Math.max(level.fill, 0.22) }
        : { color: "#b5a79b", weight: 1, dashArray: "2 5", fillColor: "#b5a79b", fillOpacity: 0.05 });
      const pop = el("div");
      pop.appendChild(el("p", "pop-title", z.name));
      pop.appendChild(el("p", "pop-meta", has ? level.label : "No safety data for this neighbourhood yet."));
      if (has) {
        const lines = [];
        if (source) lines.push(source + ".");
        if (n) lines.push(`${n} community ${n === 1 ? "report" : "reports"} in the last 7 days raised this rating.`);
        lines.push(night ? "Gets worse after dark." : "Similar day and night.");
        pop.appendChild(el("p", "pop-body", lines.join(" ")));
      }
      poly.bindPopup(pop);
      poly.bindTooltip(z.name, { permanent: false, sticky: true, direction: "top", className: "zone-tip" });
      areaLayer.addLayer(poly);
    });
  }

  // Fallback if the neighbourhood list can't be loaded: one circle per data point.
  function drawCircles() {
    state.areas.forEach((a) => {
      const level = LEVELS[a.safetyLevel] || LEVELS.CAUTION;
      const circle = L.circle([a.latitude, a.longitude], {
        radius: level.radius,
        color: level.color,
        weight: a.isNightSensitive ? 2 : 1,
        dashArray: a.isNightSensitive ? "5 6" : null,
        fillColor: level.color,
        fillOpacity: level.fill
      });
      const pop = el("div");
      pop.appendChild(el("p", "pop-title", level.label));
      pop.appendChild(el("p", "pop-meta", a.isNightSensitive ? "This area gets worse after dark." : "Similar day and night."));
      circle.bindPopup(pop);
      areaLayer.addLayer(circle);
    });
  }

  function drawAreas() {
    areaLayer.clearLayers();
    if (state.zones.length) drawZones(); else drawCircles();
  }

  /* ---------- Reports ---------- */

  function reportPopup(r) {
    const pop = el("div");
    pop.appendChild(el("p", "pop-title", r.title || categoryLabel(r.category)));
    pop.appendChild(el("p", "pop-meta", `${categoryLabel(r.category)} · ${ago(r.createdAt, r.timeLabel)}`));
    if (r.description) pop.appendChild(el("p", "pop-body", r.description));
    const actions = el("div", "pop-action");
    actions.appendChild(upvoteButton(r));
    pop.appendChild(actions);
    return pop;
  }

  function upvoteButton(r) {
    const btn = el("button", "btn-link");
    btn.type = "button";
    const label = () => `Helpful (${r.upvotes || 0})`;
    btn.textContent = label();
    const key = "viasafe-upvoted-" + r.id;
    let done = false;
    try { done = Boolean(localStorage.getItem(key)); } catch { /* storage blocked */ }
    if (done) { btn.disabled = true; btn.textContent = `Marked helpful (${r.upvotes || 0})`; }

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      try {
        await api(`/api/reports/${encodeURIComponent(r.id)}/upvote`, { method: "POST" });
        r.upvotes = (r.upvotes || 0) + 1;
        btn.textContent = `Marked helpful (${r.upvotes})`;
        try { localStorage.setItem(key, "1"); } catch { /* storage blocked */ }
        renderReportList();
      } catch (e) {
        btn.disabled = false;
        toast("Couldn't save that. Please try again.");
      }
    });
    return btn;
  }

  function drawReports() {
    reportLayer.clearLayers();
    state.reports.forEach((r) => {
      if (!Number.isFinite(r.latitude) || !Number.isFinite(r.longitude)) return;
      const verified = r.verificationStatus === "VERIFIED";
      const marker = L.marker([r.latitude, r.longitude], {
        icon: L.divIcon({
          className: "",
          html: `<div class="report-pin ${typeClass(r.category)}${verified ? " is-verified" : ""}"></div>`,
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        }),
        title: r.title || "Report",
        keyboard: true
      });
      marker.bindPopup(() => reportPopup(r));
      marker.reportId = r.id;
      reportLayer.addLayer(marker);
    });
  }

  function renderReportList() {
    const list = $("reportList");
    list.replaceChildren();
    const sorted = [...state.reports].sort((a, b) => Date.parse(b.createdAt || 0) - Date.parse(a.createdAt || 0)).slice(0, 30);

    if (!sorted.length) {
      const li = el("li", "report-item");
      li.appendChild(el("p", "report-meta", "No reports yet. Be the first to add one from the Report tab."));
      list.appendChild(li);
      return;
    }

    sorted.forEach((r) => {
      const li = el("li", "report-item");
      const head = el("div", "report-head");
      const title = el("button", "report-title", r.title || categoryLabel(r.category));
      title.type = "button";
      title.addEventListener("click", () => focusReport(r));
      head.appendChild(title);
      head.appendChild(el("span", r.verificationStatus === "VERIFIED" ? "badge" : "badge badge-quiet",
        r.verificationStatus === "VERIFIED" ? "Verified" : "Single report"));
      li.appendChild(head);

      const meta = el("p", "report-meta");
      meta.appendChild(el("span", "type-dot " + typeClass(r.category)));
      meta.appendChild(el("span", null, `${categoryLabel(r.category)} · ${r.locationLabel || "Cluj-Napoca"} · ${ago(r.createdAt, r.timeLabel)}`));
      li.appendChild(meta);

      if (r.description) li.appendChild(el("p", "report-desc", r.description));
      const actions = el("div", "report-actions");
      actions.appendChild(upvoteButton(r));
      li.appendChild(actions);
      list.appendChild(li);
    });
  }

  function focusReport(r) {
    if (!Number.isFinite(r.latitude)) return;
    showTab("map");
    if (window.matchMedia("(max-width: 760px)").matches) collapseSheet();
    map.flyTo([r.latitude, r.longitude], 16, { duration: 0.8 });
    reportLayer.eachLayer((m) => { if (m.reportId === r.id) setTimeout(() => m.openPopup(), 850); });
  }

  function renderSummary() {
    const active = state.reports.filter(isActivePin).length;
    const parts = [];
    if (state.zones.length) {
      const rated = state.zones.filter((z) => z.safetyLevel);
      const care = rated.filter((z) => z.safetyLevel !== "SAFE").length;
      parts.push(`${care} of ${rated.length} rated neighbourhoods need extra care.`);
    } else {
      const care = state.areas.filter((a) => a.safetyLevel !== "SAFE").length;
      parts.push(`${care} of ${state.areas.length} mapped areas need extra care.`);
    }
    parts.push(active === 1 ? "1 recent report is being avoided in routes." : `${active} recent reports are being avoided in routes.`);
    $("mapSummary").textContent = state.areas.length || state.zones.length ? parts.join(" ") : "No area data yet.";
  }

  // Frame the map on where the data actually is, ignoring a few far-out points.
  function fitToData() {
    const pts = [...state.reports, ...state.areas]
      .filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude))
      .map((p) => [p.latitude, p.longitude]);
    if (pts.length < 3) return;
    const median = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)];
    const mLat = median(pts.map((p) => p[0]));
    const mLng = median(pts.map((p) => p[1]));
    const near = pts.filter((p) => Math.abs(p[0] - mLat) < 0.045 && Math.abs(p[1] - mLng) < 0.07);
    if (near.length >= 3) map.fitBounds(L.latLngBounds(near), { padding: [40, 40], maxZoom: 15 });
  }

  async function loadData() {
    clearNotice();
    $("mapSummary").textContent = "Loading the city…";
    try {
      const [areas, reports, cartiere] = await Promise.all([
        api("/api/risk-map"),
        api("/api/reports"),
        fetch("cartiere.json").then((r) => (r.ok ? r.json() : [])).catch(() => [])
      ]);
      state.zones = Array.isArray(cartiere) && cartiere.length ? buildZones(cartiere) : [];
      state.areas = Array.isArray(areas) ? areas : [];
      state.reports = (Array.isArray(reports) ? reports : []).filter((r) => !isPlaceholderReport(r));
      drawAreas();
      drawReports();
      renderReportList();
      renderSummary();
      fitToData();
    } catch (e) {
      $("mapSummary").textContent = "The map couldn't be loaded.";
      showNotice("Can't reach the ViaSafe server. Check that it is running.", loadData);
    }
  }

  $("toggleAreas").addEventListener("change", (e) => {
    e.target.checked ? map.addLayer(areaLayer) : map.removeLayer(areaLayer);
  });
  $("toggleReports").addEventListener("change", (e) => {
    e.target.checked ? map.addLayer(reportLayer) : map.removeLayer(reportLayer);
  });

  /* ---------- Picking places ---------- */

  const PICK_TEXT = {
    from: "Tap the map to set your start",
    to: "Tap the map to set your destination",
    report: "Tap the map where it happened"
  };

  function startPick(kind) {
    state.pick = kind;
    $("pickText").textContent = PICK_TEXT[kind];
    $("pickBanner").hidden = false;
    document.body.classList.add("is-picking");
    map.closePopup();
    if (window.matchMedia("(max-width: 760px)").matches) collapseSheet();
  }

  function cancelPick() {
    state.pick = null;
    $("pickBanner").hidden = true;
    document.body.classList.remove("is-picking");
  }

  $("pickCancel").addEventListener("click", () => { cancelPick(); expandSheet(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.pick) { cancelPick(); expandSheet(); } });

  map.on("click", (e) => {
    if (!state.pick) return;
    const kind = state.pick;
    cancelPick();
    setPoint(kind, e.latlng.lat, e.latlng.lng, "Pinned on the map");
    expandSheet();
  });

  document.querySelectorAll("[data-pick]").forEach((b) => {
    b.addEventListener("click", () => startPick(b.dataset.pick));
  });

  document.querySelectorAll("[data-locate]").forEach((b) => {
    b.addEventListener("click", () => {
      const kind = b.dataset.locate;
      if (!navigator.geolocation) { toast("Your browser can't share your location."); return; }
      b.disabled = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          b.disabled = false;
          setPoint(kind, pos.coords.latitude, pos.coords.longitude, "My location");
        },
        () => {
          b.disabled = false;
          toast("Couldn't get your location. Allow location access, or pick a place on the map.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });
  });

  function pointIcon(kind) {
    const text = kind === "from" ? "A" : kind === "to" ? "B" : "!";
    return L.divIcon({
      className: "",
      html: `<div class="route-point${kind === "to" ? " end" : ""}">${text}</div>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11]
    });
  }

  function setPoint(kind, lat, lng, label) {
    state.points[kind] = { lat, lng, label };
    redrawPoints();

    if (kind === "from") $("fromInput").value = label;
    if (kind === "to") $("toInput").value = label;
    if (kind === "report") {
      $("reportWhere").textContent = `${label} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    }
    document.querySelectorAll(`[data-pick="${kind}"]`).forEach((b) => b.classList.add("is-set"));
    map.panTo([lat, lng]);
  }

  function redrawPoints() {
    pointLayer.clearLayers();
    Object.entries(state.points).forEach(([kind, p]) => {
      if (p) pointLayer.addLayer(L.marker([p.lat, p.lng], { icon: pointIcon(kind), interactive: false, keyboard: false }));
    });
  }

  /* ---------- Address search (OpenStreetMap Nominatim) ---------- */

  function setupSearch(kind, inputId, listId) {
    const input = $(inputId);
    const list = $(listId);
    let timer;
    let seq = 0;

    input.addEventListener("input", () => {
      state.points[kind] = null;
      redrawPoints();
      document.querySelectorAll(`[data-pick="${kind}"]`).forEach((b) => b.classList.remove("is-set"));
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 3) { list.hidden = true; return; }
      timer = setTimeout(() => search(q), 600);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape") list.hidden = true;
      if (e.key === "ArrowDown" && !list.hidden) {
        const first = list.querySelector("button");
        if (first) { e.preventDefault(); first.focus(); }
      }
    });

    list.addEventListener("keydown", (e) => {
      const items = Array.from(list.querySelectorAll("button"));
      const i = items.indexOf(document.activeElement);
      if (e.key === "ArrowDown" && i < items.length - 1) { e.preventDefault(); items[i + 1].focus(); }
      if (e.key === "ArrowUp") { e.preventDefault(); (i > 0 ? items[i - 1] : input).focus(); }
      if (e.key === "Escape") { list.hidden = true; input.focus(); }
    });

    document.addEventListener("click", (e) => {
      if (!list.contains(e.target) && e.target !== input) list.hidden = true;
    });

    async function search(q) {
      const mine = ++seq;
      const url = "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ro&bounded=1" +
        "&viewbox=23.45,46.85,23.78,46.70&q=" + encodeURIComponent(q);
      list.replaceChildren();
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        const rows = await res.json();
        if (mine !== seq) return;
        if (!rows.length) {
          list.appendChild(el("li", "none", "No match in Cluj-Napoca. Try another spelling, or pick on the map."));
        } else {
          rows.forEach((row) => {
            const li = el("li");
            const name = row.display_name.split(",").slice(0, 3).join(",").trim();
            const b = el("button", null, name);
            b.type = "button";
            b.addEventListener("click", () => {
              list.hidden = true;
              setPoint(kind, Number(row.lat), Number(row.lon), name);
              map.flyTo([Number(row.lat), Number(row.lon)], 16, { duration: 0.6 });
            });
            li.appendChild(b);
            list.appendChild(li);
          });
        }
      } catch {
        if (mine !== seq) return;
        list.appendChild(el("li", "none", "Search isn't available right now. Pick the place on the map instead."));
      }
      list.hidden = false;
    }
  }

  setupSearch("from", "fromInput", "fromResults");
  setupSearch("to", "toInput", "toResults");

  /* ---------- Safe route ---------- */

  function decodePolyline6(str) {
    const coords = [];
    let index = 0, lat = 0, lng = 0;
    while (index < str.length) {
      for (const axis of ["lat", "lng"]) {
        let shift = 0, result = 0, byte;
        do {
          byte = str.charCodeAt(index++) - 63;
          result |= (byte & 0x1f) << shift;
          shift += 5;
        } while (byte >= 0x20);
        const delta = (result & 1) ? ~(result >> 1) : (result >> 1);
        if (axis === "lat") lat += delta; else lng += delta;
      }
      coords.push([lat / 1e6, lng / 1e6]);
    }
    return coords;
  }

  function showResult(content, warn) {
    const box = $("routeResult");
    box.replaceChildren(...content);
    box.classList.toggle("is-warn", Boolean(warn));
    box.hidden = false;
  }

  $("routeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const { from, to } = state.points;
    $("fromInput").classList.toggle("invalid", !from);
    $("toInput").classList.toggle("invalid", !to);
    if (!from || !to) {
      showResult([el("p", null, "Choose a start and a destination first. Pick from the suggestions, use your location, or tap the map.")], true);
      return;
    }

    if (!inCluj(from) || !inCluj(to)) {
      showResult([
        el("p", "result-main", "Outside Cluj-Napoca"),
        el("p", null, "ViaSafe only covers Cluj-Napoca for now. Choose a start and a destination inside the city.")
      ], true);
      return;
    }

    const btn = $("routeBtn");
    const routeIdle = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Finding route…";
    routeLayer.clearLayers();

    try {
      const data = await api("/api/routes/safe", {
        method: "POST",
        body: JSON.stringify({ startLat: from.lat, startLng: from.lng, endLat: to.lat, endLng: to.lng })
      });

      const shape = data && data.trip && data.trip.legs && data.trip.legs[0] && data.trip.legs[0].shape;
      if (!shape) {
        if (data && data.warning) {
          showResult([
            el("p", "result-main", "Safe routing isn't connected"),
            el("p", null, "The map and reports work, but route finding needs a routing server (Valhalla). Add its address as VALHALLA_URL on the server, then try again.")
          ], true);
        } else {
          const why = (data && (data.error || data.message)) || "No walking route was found between these two places.";
          showResult([el("p", "result-main", "No route found"), el("p", null, String(why))], true);
        }
        return;
      }

      const line = decodePolyline6(shape);
      L.polyline(line, { color: "#ffffff", weight: 11, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(routeLayer);
      const route = L.polyline(line, { color: "#b66d5a", weight: 6, lineCap: "round", lineJoin: "round" }).addTo(routeLayer);
      map.fitBounds(route.getBounds(), { padding: [60, 60] });
      if (window.matchMedia("(max-width: 760px)").matches) collapseSheet();

      const summary = data.trip.summary || {};
      const km = Number(summary.length);
      const mins = Math.max(1, Math.round(Number(summary.time) / 60));
      const avoided = Math.min(MAX_AVOID, state.reports.filter(isActivePin).length);

      const main = el("p", "result-main", `${mins} min `);
      main.appendChild(el("small", null, Number.isFinite(km) ? `· ${km.toFixed(1)} km on foot` : "on foot"));
      showResult([
        main,
        el("p", null, avoided
          ? `Steers around ${avoided} recent ${avoided === 1 ? "report" : "reports"} from the last 2 hours.`
          : "No recent reports to avoid right now.")
      ]);
    } catch (err) {
      showResult([el("p", "result-main", "Couldn't find a route"), el("p", null, err.message || "Please try again in a moment.")], true);
    } finally {
      btn.disabled = false;
      btn.textContent = routeIdle;
    }
  });

  $("clearRoute").addEventListener("click", () => {
    routeLayer.clearLayers();
    $("routeResult").hidden = true;
    state.points.from = null;
    state.points.to = null;
    redrawPoints();
    $("fromInput").value = "";
    $("toInput").value = "";
    document.querySelectorAll('[data-pick="from"], [data-pick="to"]').forEach((b) => b.classList.remove("is-set"));
  });

  /* ---------- Send a report ---------- */

  $("reportForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = $("reportTitle").value.trim();
    const where = state.points.report;
    $("reportTitle").classList.toggle("invalid", !title);
    if (!title) { $("reportTitle").focus(); return; }
    if (!where) { toast("Choose where it happened first."); return; }
    if (!inCluj(where)) { toast("ViaSafe only covers Cluj-Napoca. Choose a place inside the city."); return; }

    const category = document.querySelector('input[name="category"]:checked').value;
    const btn = $("reportBtn");
    const reportIdle = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending…";

    try {
      const created = await api("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: $("reportDesc").value.trim(),
          category,
          timeLabel: "just now",
          locationLabel: where.label === "Pinned on the map" || where.label === "My location" ? "Cluj-Napoca" : where.label,
          latitude: where.lat,
          longitude: where.lng,
          anonymous: $("reportAnon").checked
        })
      });
      state.reports.unshift(created);
      drawAreas();
      drawReports();
      renderReportList();
      renderSummary();

      $("reportForm").reset();
      state.points.report = null;
      redrawPoints();
      $("reportWhere").textContent = "No place chosen yet.";
      document.querySelectorAll('[data-pick="report"]').forEach((b) => b.classList.remove("is-set"));

      showTab("map");
      map.flyTo([created.latitude, created.longitude], 16, { duration: 0.8 });
      toast(isPinType(category) ? "Thank you. New routes will avoid this spot for 2 hours." : "Thank you. Your report is on the map.");
    } catch (err) {
      toast(err.message || "Couldn't send your report. Please try again.");
    } finally {
      btn.disabled = false;
      btn.textContent = reportIdle;
    }
  });

  $("reportTitle").addEventListener("input", (e) => e.target.classList.remove("invalid"));

  /* ---------- Go ---------- */

  loadData();
})();
