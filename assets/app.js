/* Shared code for the retrospective pages: data loading, derived fields, formatting, tooltip and SVG charts.
   Every number on the pages comes from docs/data/history.json (built by scripts/build_history.py). Opened from disk
   (file://) browsers block fetch(), so the same data is also loaded from data/history.js. */
(function () {
  'use strict';
  const N_TEST = 1319;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const C = { sub: '#f97316', base: '#9b988f', a: '#3987e5', b: '#1fae7c', grid: '#332c27', axis: '#574c43', surface: '#201c19' };
  const ERA = {
    old: { label: 'old trainer (packed rows kept apart)', color: C.sub, shape: 'diamond' },
    packed: { label: 'packed, rows attend to each other (after 1be6037)', color: C.a, shape: 'circle' },
    unpacked: { label: 'unpacked, one row per sequence', color: C.b, shape: 'square' },
  };

  // ---------- data ----------
  async function loadHistory() {
    if (window.HISTORY) return window.HISTORY;
    if (location.protocol !== 'file:') {
      try {
        const r = await fetch('data/history.json', { cache: 'no-cache' });
        if (r.ok) return await r.json();
      } catch (e) { /* fall back to the script copy */ }
    }
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'data/history.js';
      s.onload = resolve;
      s.onerror = () => reject(new Error('could not load data/history.js'));
      document.head.appendChild(s);
    });
    return window.HISTORY;
  }

  // Wall-clock PDT times kept as UTC numbers so no viewer time zone can shift them.
  function runTime(s) {
    const m = /^(\d\d)-(\d\d) (\d\d):(\d\d)$/.exec(s || '');
    return m ? Date.UTC(2026, +m[1] - 1, +m[2], +m[3], +m[4]) : null;
  }
  function eventTime(s) {
    const m = /(\d{4})-(\d\d)-(\d\d) ~?(\d\d):(\d\d)/.exec(s || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
  }
  function eraOf(r) {
    if (r.phase === 'P1' || r.phase === 'P2') return 'old';
    if (/unpacked/.test(r.method) || r.phase === 'P6' || /\b960\b/.test(r.data)) return 'unpacked';
    return 'packed';
  }

  function derive(D) {
    const runs = D.runs.map((r, i) => Object.assign({}, r, {
      idx: i, t: runTime(r.time), era: eraOf(r), T: r.test_result || null, V: r.val_result || null,
    }));
    const byId = Object.fromEntries(runs.map(r => [r.id, r]));
    const sub = runs.find(r => r.submitted);
    // The untouched control is the tested run that differs from the base on no item.
    const base = runs.find(r => r.T && !r.submitted && r.T.vs_base[0] === 0 && r.T.vs_base[1] === 0);
    const tested = runs.filter(r => r.T);
    const later = tested.filter(r => r !== sub && r !== base);
    const afterChange = tested.filter(r => !['P1', 'P2'].includes(r.phase));
    const bestAfter = afterChange.reduce((a, r) => (!a || r.T.correct > a.T.correct ? r : a), null);
    const valRef = runs.find(r => r.V && r.V.n === 500 && r.V.correct === r.V.base_correct && r.lr <= 1e-8 && r.base === sub.base);
    const phases = D.phases.map(p => Object.assign({}, p, { runs: runs.filter(r => r.phase === p.id) }));
    const events = D.platform_events.map(e => Object.assign({}, e, { t: eventTime(e.time) })).sort((a, b) => a.t - b.t);
    const board = D.leaderboard_final;
    const us = board.find(b => Math.abs(b.score - D.submission.board_shows) < 1e-9);
    return { D, runs, byId, sub, base, tested, later, afterChange, bestAfter, valRef, phases, events, board, us, N: N_TEST };
  }

  // ---------- numbers ----------
  const int = n => (n == null ? '—' : Number(n).toLocaleString('en-US'));
  const pct = (c, n, d = 2) => (100 * c / n).toFixed(d) + '%';
  const fix = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));
  const signed = (v, d = 0) => (v > 0 ? '+' : v < 0 ? '−' : '±') + Math.abs(v).toFixed(d);
  function lr(v) {
    if (v == null) return '—';
    const [m, e] = v.toExponential().split('e');
    return String(+(+m).toPrecision(3)) + 'e' + (+e);
  }
  const scoreAt = (correct, params) => 100 * correct / N_TEST - params;
  // Smallest number of correct test items whose score reaches `target` with `params` billion parameters.
  const itemsFor = (target, params) => Math.ceil((target + params) * N_TEST / 100 - 1e-6);
  const valDelta = r => (r.V ? r.V.correct - r.V.base_correct : null);
  const valStr = r => (r.V ? `${int(r.V.correct)} / ${int(r.V.n)}` : '—');
  const testStr = r => (r.T ? `${int(r.T.correct)} / ${int(r.T.n)}` : '—');
  function stepsStr(r) {
    if (r.steps) return `${r.steps} steps`;
    if (r.epochs) return `${r.epochs} ep`;
    return '—';
  }
  function fmtTime(ms, withDay = true) {
    const d = new Date(ms);
    const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
    return (withDay ? `Oct ${d.getUTCDate()} ` : '') + `${hh}:${mm}`;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // Inline `code` spans in lesson text.
  const rich = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>');

  // ---------- DOM ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'html') el.innerHTML = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null) el.append(k.nodeType ? k : document.createTextNode(k));
    return el;
  }
  function s(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) el.setAttribute(k, v);
    if (parent) parent.appendChild(el);
    return el;
  }

  // ---------- tooltip ----------
  let tipEl = null;
  function tip(html, x, y) {
    if (!tipEl) { tipEl = h('div', { class: 'tip', role: 'status' }); document.body.appendChild(tipEl); }
    if (html == null) { tipEl.hidden = true; return; }
    tipEl.innerHTML = html;
    tipEl.hidden = false;
    const r = tipEl.getBoundingClientRect();
    let left = x + 14, top = y + 14;
    if (left + r.width > window.innerWidth - 8) left = Math.max(8, x - r.width - 14);
    if (top + r.height > window.innerHeight - 8) top = Math.max(8, y - r.height - 14);
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }
  document.addEventListener('scroll', () => tip(null), { passive: true });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') tip(null); });

  // ---------- marks ----------
  function shape(parent, kind, x, y, r, fill) {
    const ring = { stroke: C.surface, 'stroke-width': 2 };
    if (kind === 'square') return s('rect', Object.assign({ x: x - r * 0.88, y: y - r * 0.88, width: r * 1.76, height: r * 1.76, fill }, ring), parent);
    if (kind === 'diamond') { const q = r * 1.3; return s('path', Object.assign({ d: `M${x} ${y - q}L${x + q} ${y}L${x} ${y + q}L${x - q} ${y}Z`, fill }, ring), parent); }
    if (kind === 'triangle') { const q = r * 1.25; return s('path', Object.assign({ d: `M${x} ${y - q}L${x + q} ${y + q * 0.8}L${x - q} ${y + q * 0.8}Z`, fill }, ring), parent); }
    return s('circle', Object.assign({ cx: x, cy: y, r, fill }, ring), parent);
  }
  function swatch(kind, color, line) {
    const svg = s('svg', { width: 18, height: 14, viewBox: '0 0 18 14', 'aria-hidden': 'true' });
    if (line) s('line', { x1: 1, y1: 7, x2: 17, y2: 7, stroke: color, 'stroke-width': 2 }, svg);
    else shape(svg, kind, 9, 7, 4.5, color);
    return svg;
  }
  function legend(items) {
    return h('div', { class: 'legend' }, items.map(it => h('span', null, swatch(it.shape, it.color, it.line), it.label)));
  }

  // ---------- generic point chart ----------
  // cfg: { title, height, x: {type, domain, ticks(narrow), fmt, label}, y: {domain, ticks, fmt, label},
  //        hlines: [{y, color, label}], vlines: [{x, label}], points: [{x, y, color, shape, r, z, label, tip}], legend: [...] }
  function plot(host, cfg) {
    let lastW = 0;
    function scale(ax, r0, r1) {
      const [d0, d1] = ax.domain;
      if (ax.type === 'log') { const a = Math.log10(d0), b = Math.log10(d1); return v => r0 + (Math.log10(v) - a) / (b - a) * (r1 - r0); }
      return v => r0 + (v - d0) / (d1 - d0) * (r1 - r0);
    }
    function draw() {
      const W = Math.max(280, Math.floor(host.clientWidth));
      if (W === lastW) return;
      lastW = W;
      host.textContent = '';
      const narrow = W < 520;
      if (cfg.legend) host.appendChild(legend(cfg.legend));
      const H = cfg.height || (narrow ? 290 : 320);
      const m = Object.assign({ t: cfg.vlines ? 48 : 30, r: narrow ? 12 : 20, b: 46, l: 58 }, cfg.margin || {});
      const pw = W - m.l - m.r, ph = H - m.t - m.b;
      const sx = scale(cfg.x, m.l, m.l + pw), sy = scale(cfg.y, m.t + ph, m.t);
      const svg = s('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': cfg.title });
      host.appendChild(svg);
      // grid and axes
      for (const v of cfg.y.ticks) {
        s('line', { x1: m.l, x2: m.l + pw, y1: sy(v), y2: sy(v), stroke: C.grid, 'stroke-width': 1 }, svg);
        s('text', { x: m.l - 8, y: sy(v) + 4, 'text-anchor': 'end' }, svg).textContent = cfg.y.fmt(v);
      }
      s('line', { x1: m.l, x2: m.l + pw, y1: m.t + ph, y2: m.t + ph, stroke: C.axis, 'stroke-width': 1 }, svg);
      const xt = typeof cfg.x.ticks === 'function' ? cfg.x.ticks(narrow) : cfg.x.ticks;
      for (const v of xt) {
        s('line', { x1: sx(v), x2: sx(v), y1: m.t + ph, y2: m.t + ph + 5, stroke: C.axis }, svg);
        s('text', { x: sx(v), y: m.t + ph + 19, 'text-anchor': 'middle' }, svg).textContent = cfg.x.fmt(v, narrow);
      }
      if (cfg.x.label) s('text', { x: m.l + pw, y: H - 4, 'text-anchor': 'end' }, svg).textContent = cfg.x.label;
      if (cfg.y.label) s('text', { x: 4, y: 12 }, svg).textContent = cfg.y.label;
      // vertical markers (events) with a numbered badge on top; the page lists what each number means
      let prevBadge = -1e9;
      for (const v of cfg.vlines || []) {
        const x = sx(v.x);
        if (x < m.l - 1 || x > m.l + pw + 1) continue;
        const bx = Math.max(x, prevBadge + 17), by = m.t - 24;  // badges never overlap; the line keeps its true x
        prevBadge = bx;
        s('line', { x1: x, x2: x, y1: m.t - 4, y2: m.t + ph, stroke: C.axis, 'stroke-width': 1 }, svg);
        if (bx !== x) s('line', { x1: x, x2: bx, y1: m.t - 4, y2: by + 16, stroke: C.axis, 'stroke-width': 1 }, svg);
        s('rect', { x: bx - 8, y: by, width: 16, height: 16, fill: C.surface, stroke: C.sub, 'stroke-width': 1.5 }, svg);
        const t = s('text', { x: bx, y: by + 12, 'text-anchor': 'middle' }, svg);
        t.textContent = v.badge;
        t.style.fill = C.sub;
      }
      // reference lines; labelX (data units) places the label over an empty stretch of the plot
      for (const r of cfg.hlines || []) {
        const y = sy(r.y);
        s('line', { x1: m.l, x2: m.l + pw, y1: y, y2: y, stroke: r.color, 'stroke-width': 2 }, svg);
        if (!r.label) continue;
        const at = r.labelX != null ? sx(r.labelX) : m.l + pw - 2;
        s('text', { x: at, y: y + (r.below ? 14 : -6), 'text-anchor': r.labelX != null ? (r.anchor || 'middle') : 'end', class: 'lbl' }, svg).textContent = r.label;
      }
      // points, nudged sideways (pixels only) when they would overlap
      const pts = cfg.points.map((p, i) => Object.assign({ i, r: 5.5, z: 0 }, p, { px: sx(p.x), py: sy(p.y) }));
      const order = pts.slice().sort((a, b) => b.z - a.z || a.i - b.i);
      const placed = [];
      for (const p of order) {
        for (let k = 0; k < 60; k++) {
          const off = k === 0 ? 0 : Math.ceil(k / 2) * 3 * (k % 2 ? 1 : -1);
          const cx = p.px + off;
          if (placed.every(q => Math.hypot(q.cx - cx, q.py - p.py) >= q.r + p.r + 1.5)) { p.cx = cx; break; }
        }
        if (p.cx == null) p.cx = p.px;
        placed.push(p);
      }
      const marks = s('g', null, svg), labels = s('g', null, svg), hits = s('g', null, svg);
      for (const p of pts.slice().sort((a, b) => a.z - b.z)) {
        shape(marks, p.shape || 'circle', p.cx, p.py, p.r, p.color);
        if (p.label) {
          const est = p.label.length * 6.7;
          const left = p.labelSide === 'left' || (p.labelSide !== 'right' && p.cx + 10 + est > W - 4);
          s('text', { x: p.cx + (left ? -10 : 10), y: p.py + (p.labelDy || 4), 'text-anchor': left ? 'end' : 'start', class: 'lbl' }, labels).textContent = p.label;
        }
        if (p.tip) {
          const hit = s('circle', { cx: p.cx, cy: p.py, r: Math.max(11, p.r + 5), class: 'hit', tabindex: 0, role: 'button', 'aria-label': p.aria || p.label || 'data point' }, hits);
          const show = e => {
            const b = hit.getBoundingClientRect();
            const x = e && e.clientX != null && e.type !== 'focus' ? e.clientX : b.left + b.width / 2;
            const y = e && e.clientY != null && e.type !== 'focus' ? e.clientY : b.top + b.height / 2;
            tip(p.tip, x, y);
          };
          hit.addEventListener('pointerenter', show);
          hit.addEventListener('pointermove', show);
          hit.addEventListener('pointerdown', show);
          hit.addEventListener('focus', show);
          hit.addEventListener('pointerleave', () => tip(null));
          hit.addEventListener('blur', () => tip(null));
          if (p.href) hit.addEventListener('click', () => { location.href = p.href; });
          if (p.href) hit.addEventListener('keydown', e => { if (e.key === 'Enter') location.href = p.href; });
        }
      }
    }
    draw();
    if ('ResizeObserver' in window) {
      let raf = 0;
      new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }).observe(host);
    } else window.addEventListener('resize', draw);
  }

  // Collapsible table view under a chart: cols = [{label, num}], rows = [[cell, ...]] (cells are HTML strings).
  function tableView(cols, rows, summary) {
    const thead = h('thead', null, h('tr', null, cols.map(c => h('th', { class: c.num ? 'num' : null }, c.label))));
    const tbody = h('tbody', null, rows.map(r => h('tr', null, r.map((v, i) => h('td', { class: cols[i].num ? 'num' : null, html: v })))));
    return h('details', { class: 'tv' }, h('summary', null, summary || 'Table view'), h('div', { class: 'table-wrap' }, h('table', null, thead, tbody)));
  }

  function runTip(r, extra) {
    const lines = [`<span class="t">${esc(r.id)}</span>`];
    lines.push(`${esc(r.base.replace(/^Qwen\//, ''))} · ${esc(r.method)} · LR ${lr(r.lr)}`);
    if (r.T) lines.push(`Test <b>${int(r.T.correct)} / ${int(r.T.n)}</b> (${pct(r.T.correct, r.T.n)}) · score ${fix(r.T.score)}`);
    if (r.V) lines.push(`Val <b>${int(r.V.correct)} / ${int(r.V.n)}</b> · base ${int(r.V.base_correct)} / ${int(r.V.n)} on the same items`);
    if (extra) lines.push(extra);
    return lines.join('<br>');
  }

  async function boot(render) {
    const main = document.querySelector('main');
    try {
      const X = derive(await loadHistory());
      await render(X);
    } catch (e) {
      console.error(e);
      main.prepend(h('div', { class: 'err wrap' }, 'Could not load the run data (docs/data/history.json or data/history.js). ', String(e && e.message || e)));
    }
  }

  window.HX = { C, ERA, N_TEST, boot, derive, int, pct, fix, signed, lr, scoreAt, itemsFor, valDelta, valStr, testStr, stepsStr, fmtTime, esc, rich, h, s, tip, plot, legend, swatch, tableView, runTip };
})();
