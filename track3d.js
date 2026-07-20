(function () {
  "use strict";

  var SCALE_Y = 3;
  var RIBBON_W = 10;
  var DEG = Math.PI / 180;
  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tracks = Array.isArray(window.TRACKFANS_TRACKS) ? window.TRACKFANS_TRACKS : [];
  var qs = new URLSearchParams(location.search);
  var id = (qs.get("id") || "").trim();
  var el = {
    name: document.getElementById("track-name"),
    meta: document.getElementById("track-meta"),
    wrap: document.getElementById("canvas-wrap"),
    status: document.getElementById("status"),
    min: document.getElementById("elev-min"),
    max: document.getElementById("elev-max"),
    swing: document.getElementById("elev-swing"),
    help: document.getElementById("help-toggle"),
    panel: document.getElementById("help-panel")
  };
  var renderer, scene, camera, frame, controls;

  el.help.addEventListener("click", function () {
    var open = el.panel.hidden;
    el.panel.hidden = !open;
    el.help.setAttribute("aria-expanded", String(open));
  });

  function homeMessage(title, text) {
    el.name.textContent = title;
    el.meta.textContent = "";
    el.status.innerHTML = text + ' <a href="./index.html">Back to index</a>.';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtM(n) {
    return Math.round(n).toLocaleString() + " m";
  }

  function lengthLabel(track) {
    return typeof track.length_km === "number" ? track.length_km.toFixed(3).replace(/0+$/, "").replace(/\.$/, "") + " km" : "length unknown";
  }

  function lineCoords(geo) {
    var f = geo && geo.type === "FeatureCollection" ? geo.features && geo.features[0] : geo;
    var g = f && (f.geometry || f);
    if (!g) return null;
    if (g.type === "LineString") return g.coordinates;
    if (g.type === "MultiLineString") return g.coordinates.reduce(function (a, b) { return a.length > b.length ? a : b; }, []);
    return null;
  }

  function cumulative2(points) {
    var out = [0], total = 0;
    for (var i = 1; i < points.length; i++) {
      total += Math.hypot(points[i].x - points[i - 1].x, points[i].z - points[i - 1].z);
      out.push(total);
    }
    return { values: out, total: total };
  }

  function interp(xs, ys, x) {
    if (x <= xs[0]) return ys[0];
    for (var i = 1; i < xs.length; i++) {
      if (x <= xs[i]) {
        var t = (x - xs[i - 1]) / Math.max(1e-6, xs[i] - xs[i - 1]);
        return ys[i - 1] + (ys[i] - ys[i - 1]) * t;
      }
    }
    return ys[ys.length - 1];
  }

  function buildPoints(coords, elev) {
    var lon = 0, lat = 0;
    coords.forEach(function (p) { lon += p[0]; lat += p[1]; });
    lon /= coords.length;
    lat /= coords.length;
    var cosLat = Math.cos(lat * DEG);
    var flat = coords.map(function (p) {
      return { x: (p[0] - lon) * 111320 * cosLat, z: -(p[1] - lat) * 110540 };
    });
    var dist = cumulative2(flat);
    var maxElevD = elev.distance_m[elev.distance_m.length - 1];
    return flat.map(function (p, i) {
      var e = interp(elev.distance_m, elev.elevation_m, dist.values[i] / Math.max(1, dist.total) * maxElevD);
      return { x: p.x, y: e * SCALE_Y, z: p.z, e: e, d: dist.values[i] };
    });
  }

  function sideAt(points, i) {
    var a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    var dx = b.x - a.x, dz = b.z - a.z;
    var len = Math.hypot(dx, dz) || 1;
    return { x: -dz / len, z: dx / len };
  }

  function addRibbon(points, minY) {
    var verts = [], topIdx = [], leftIdx = [], rightIdx = [], half = RIBBON_W / 2;
    points.forEach(function (p, i) {
      var n = sideAt(points, i);
      topIdx.push(verts.length / 3);
      verts.push(p.x + n.x * half, p.y, p.z + n.z * half, p.x - n.x * half, p.y, p.z - n.z * half);
      leftIdx.push(verts.length / 3);
      verts.push(p.x + n.x * half, minY, p.z + n.z * half, p.x - n.x * half, minY, p.z - n.z * half);
      rightIdx.push(leftIdx[leftIdx.length - 1] + 1);
    });
    var facesTop = [], facesSkirt = [];
    for (var i = 0; i < points.length - 1; i++) {
      var a = topIdx[i], b = a + 1, c = topIdx[i + 1], d = c + 1;
      facesTop.push(a, c, b, b, c, d);
      facesSkirt.push(a, leftIdx[i], c, c, leftIdx[i], leftIdx[i + 1], b, d, rightIdx[i], d, rightIdx[i + 1], rightIdx[i]);
    }
    var top = new THREE.BufferGeometry();
    top.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    top.setIndex(facesTop);
    top.computeVertexNormals();
    scene.add(new THREE.Mesh(top, new THREE.MeshBasicMaterial({ color: 0xe10600, transparent: true, opacity: 0.85, side: THREE.DoubleSide })));
    var skirt = new THREE.BufferGeometry();
    skirt.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    skirt.setIndex(facesSkirt);
    scene.add(new THREE.Mesh(skirt, new THREE.MeshBasicMaterial({ color: 0x6f0300, side: THREE.DoubleSide })));
  }

  function addLines(points, minY) {
    var mat = new THREE.LineBasicMaterial({ color: 0xf5f3ee, transparent: true, opacity: 0.22 });
    for (var next = 500, i = 1; i < points.length; i++) {
      if (points[i].d >= next) {
        var g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(points[i].x, minY, points[i].z), new THREE.Vector3(points[i].x, points[i].y, points[i].z)]);
        scene.add(new THREE.Line(g, mat));
        next += 500;
      }
    }
    var n = sideAt(points, 0), p = points[0], h = RIBBON_W * 0.9;
    var start = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(p.x + n.x * h, p.y + 2, p.z + n.z * h),
      new THREE.Vector3(p.x - n.x * h, p.y + 2, p.z - n.z * h)
    ]);
    scene.add(new THREE.Line(start, new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 1 })));
  }

  function bounds(points, minY) {
    var box = new THREE.Box3();
    points.forEach(function (p) { box.expandByPoint(new THREE.Vector3(p.x, p.y, p.z)); });
    box.expandByPoint(new THREE.Vector3(0, minY, 0));
    return box;
  }

  function setupCamera(box) {
    var size = new THREE.Vector3(), center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100000);
    controls = { az: 45 * DEG, el: 35 * DEG, zoom: 1, center: center, span: Math.max(size.x, size.z, size.y * 2, 100) * 1.35, last: 0 };
    updateCamera();
  }

  function updateCamera() {
    var aspect = el.wrap.clientWidth / Math.max(1, el.wrap.clientHeight);
    var span = controls.span / controls.zoom;
    camera.left = -span * aspect / 2;
    camera.right = span * aspect / 2;
    camera.top = span / 2;
    camera.bottom = -span / 2;
    var r = controls.span * 2.4, c = controls.center;
    camera.position.set(c.x + Math.sin(controls.az) * Math.cos(controls.el) * r, c.y + Math.sin(controls.el) * r, c.z + Math.cos(controls.az) * Math.cos(controls.el) * r);
    camera.lookAt(c);
    camera.updateProjectionMatrix();
  }

  function initControls() {
    var down = false, lx = 0, ly = 0;
    function touched() { controls.last = performance.now(); }
    renderer.domElement.addEventListener("pointerdown", function (e) { down = true; lx = e.clientX; ly = e.clientY; touched(); renderer.domElement.setPointerCapture(e.pointerId); });
    renderer.domElement.addEventListener("pointermove", function (e) {
      if (!down) return;
      controls.az -= (e.clientX - lx) * 0.006;
      controls.el = Math.max(15 * DEG, Math.min(75 * DEG, controls.el + (e.clientY - ly) * 0.004));
      lx = e.clientX; ly = e.clientY; touched(); updateCamera();
    });
    renderer.domElement.addEventListener("pointerup", function () { down = false; touched(); });
    renderer.domElement.addEventListener("wheel", function (e) {
      e.preventDefault();
      controls.zoom = Math.max(0.45, Math.min(5, controls.zoom * (e.deltaY > 0 ? 0.9 : 1.1)));
      touched(); updateCamera();
    }, { passive: false });
    window.addEventListener("keydown", function (e) {
      var k = e.key.toLowerCase();
      if (k === "arrowleft") controls.az -= 0.08;
      else if (k === "arrowright") controls.az += 0.08;
      else if (k === "arrowup") controls.el = Math.min(75 * DEG, controls.el + 0.06);
      else if (k === "arrowdown") controls.el = Math.max(15 * DEG, controls.el - 0.06);
      else if (k === "r") { controls.az = 45 * DEG; controls.el = 35 * DEG; controls.zoom = 1; }
      else return;
      touched(); updateCamera();
    });
  }

  function renderLoop(now) {
    if (!reduced && controls && now - controls.last > 2500) {
      controls.az += 0.0007;
      updateCamera();
    }
    renderer.render(scene, camera);
    frame = requestAnimationFrame(renderLoop);
  }

  function resize() {
    if (!renderer || !camera) return;
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(el.wrap.clientWidth, el.wrap.clientHeight, false);
    updateCamera();
  }

  function draw(track, geo, elev) {
    var coords = lineCoords(geo);
    if (!coords || coords.length < 2 || !Array.isArray(elev.distance_m) || !Array.isArray(elev.elevation_m)) throw new Error("Track data is incomplete.");
    var points = buildPoints(coords, elev);
    var min = Math.min.apply(null, elev.elevation_m), max = Math.max.apply(null, elev.elevation_m), swing = max - min, minY = min * SCALE_Y;
    el.name.textContent = track.name;
    el.meta.textContent = [track.country, lengthLabel(track), fmtM(swing) + " elevation swing"].join(" / ");
    el.min.textContent = fmtM(min);
    el.max.textContent = fmtM(max);
    el.swing.textContent = fmtM(swing);
    el.status.hidden = true;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090a0c);
    var box = bounds(points, minY);
    var size = new THREE.Vector3(); box.getSize(size);
    var grid = new THREE.GridHelper(Math.max(size.x, size.z) * 1.35, 24, 0x3b3f47, 0x20242a);
    grid.position.y = minY;
    scene.add(grid);
    addRibbon(points, minY);
    addLines(points, minY);
    setupCamera(box);
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", track.name + " 3D elevation ribbon, " + fmtM(swing) + " elevation change");
    renderer.domElement.setAttribute("aria-describedby", "control-hint legend");
    el.wrap.appendChild(renderer.domElement);
    resize();
    initControls();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(renderLoop);
  }

  window.addEventListener("pagehide", function () {
    if (frame) cancelAnimationFrame(frame);
    if (renderer) renderer.dispose();
  });

  var track = tracks.find(function (t) { return t.id === id; });
  if (!id || !track) {
    homeMessage("Circuit not found", "That circuit id is not in the Trackfans index.");
    return;
  }
  el.name.textContent = track.name;
  el.meta.textContent = [track.country, lengthLabel(track)].join(" / ");

  Promise.all([
    fetch("./outlines/" + encodeURIComponent(id) + ".geojson").then(function (r) { if (!r.ok) throw new Error("Missing outline"); return r.json(); }),
    fetch("./elevation/" + encodeURIComponent(id) + ".json").then(function (r) { if (!r.ok) throw new Error("Missing elevation"); return r.json(); })
  ]).then(function (data) {
    draw(track, data[0], data[1]);
  }).catch(function () {
    homeMessage(track.name, "The outline or elevation file could not be loaded for this circuit.");
  });
}());
