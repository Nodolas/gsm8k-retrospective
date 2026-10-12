/* Runs page: sortable, filterable table of every run; a row opens its detail card (also via runs.html#<run id>). */
HX.boot(X => {
  const { h, int, pct, fix, lr, esc, rich, signed } = HX;
  const { D, runs, sub, base, N } = X;
  const phaseName = Object.fromEntries(D.phases.map(p => [p.id, p.name]));
  const pIdx = Object.fromEntries(D.phases.map((p, i) => [p.id, i]));
  const style = x => (x.T ? { calc: x.T.calc_share, chars: x.T.mean_chars, src: 'test' } : x.V ? { calc: x.V.calc_share, chars: x.V.mean_chars, src: 'val' } : null);

  const COLS = [
    { k: 'id', label: 'Run', key: x => x.id, cell: x => esc(x.id), cls: 'id' },
    { k: 'phase', label: 'Phase', key: x => pIdx[x.phase] * 1000 + x.idx, cell: x => x.phase },
    { k: 'base', label: 'Base', key: x => x.base, cell: x => esc(x.base.replace('Qwen/', '')) },
    { k: 'method', label: 'Method', key: x => x.method, cell: x => esc(x.method) },
    { k: 'data', label: 'Data', key: x => x.data, cell: x => esc(x.data) },
    { k: 'lr', label: 'LR', num: true, key: x => x.lr, cell: x => lr(x.lr) },
    { k: 'batch', label: 'Batch', num: true, key: x => x.batch, cell: x => String(x.batch) },
    { k: 'steps', label: 'Steps', num: true, key: x => (x.steps || 0) * 10 + (x.epochs || 0), cell: x => HX.stepsStr(x) },
    { k: 'val', label: 'Val', num: true, key: x => (x.V ? (x.V.correct - x.V.base_correct) / x.V.n : null),
      cell: x => (x.V ? `${int(x.V.correct)}/${int(x.V.n)} <span class="muted">(${signed(x.V.correct - x.V.base_correct)})</span>` : '—') },
    { k: 'test', label: 'Test', num: true, key: x => (x.T ? x.T.correct : null), cell: x => (x.T ? `${int(x.T.correct)}/${int(x.T.n)}` : '—') },
    { k: 'score', label: 'Score', num: true, key: x => (x.T ? x.T.score : null), cell: x => (x.T ? fix(x.T.score) : '—') },
    { k: 'calc', label: '<<calc>>', num: true, key: x => (style(x) ? style(x).calc : null), cell: x => (style(x) ? `${fix(style(x).calc, 2)}${style(x).src === 'val' ? ' <span class="muted">v</span>' : ''}` : '—') },
    { k: 'chars', label: 'Chars', num: true, key: x => (style(x) ? style(x).chars : null), cell: x => (style(x) ? `${int(style(x).chars)}${style(x).src === 'val' ? ' <span class="muted">v</span>' : ''}` : '—') },
    { k: 'outcome', label: 'Outcome', key: x => x.outcome || '', cell: x => esc(x.outcome || '—') },
  ];

  // ---------- filters ----------
  const q = document.getElementById('f-q'), fp = document.getElementById('f-phase'), fb = document.getElementById('f-base'), fr = document.getElementById('f-res');
  D.phases.forEach(p => fp.append(h('option', { value: p.id }, `${p.id} · ${p.name}`)));
  [...new Set(runs.map(x => x.base))].forEach(b => fb.append(h('option', { value: b }, b)));
  let sortK = 'phase', dir = 1;

  const thead = document.querySelector('#runs thead tr'), tbody = document.querySelector('#runs tbody');
  for (const c of COLS) {
    const btn = h('button', { type: 'button', 'data-k': c.k }, c.label, h('span', { class: 'arrow', 'aria-hidden': 'true' }, ''));
    btn.addEventListener('click', () => { dir = sortK === c.k ? -dir : c.num ? -1 : 1; sortK = c.k; render(); });
    thead.append(h('th', { class: c.num ? 'num' : null, scope: 'col' }, btn));
  }

  function visible() {
    const term = q.value.trim().toLowerCase();
    return runs.filter(x =>
      (!fp.value || x.phase === fp.value) && (!fb.value || x.base === fb.value) &&
      (!fr.value || (fr.value === 'test' ? x.T : fr.value === 'val' ? x.V : !x.T && !x.V)) &&
      (!term || [x.id, x.method, x.data, x.outcome, x.lesson, x.base].join(' ').toLowerCase().includes(term)));
  }
  function render() {
    const col = COLS.find(c => c.k === sortK);
    const rows = visible().sort((a, b) => {
      const ka = col.key(a), kb = col.key(b);
      if (ka == null && kb == null) return a.idx - b.idx;
      if (ka == null) return 1;
      if (kb == null) return -1;
      return (ka < kb ? -1 : ka > kb ? 1 : a.idx - b.idx) * dir;
    });
    thead.querySelectorAll('th').forEach((th, i) => {
      const on = COLS[i].k === sortK;
      th.setAttribute('aria-sort', on ? (dir > 0 ? 'ascending' : 'descending') : 'none');
      th.querySelector('.arrow').textContent = on ? (dir > 0 ? '▲' : '▼') : '';
    });
    tbody.replaceChildren(...rows.map(x => {
      const tr = h('tr', { tabindex: 0, class: x.submitted ? 'submitted' : null, 'aria-label': `Open run ${x.id}` },
        COLS.map(c => h('td', { class: [c.num ? 'num' : '', c.cls || ''].join(' ').trim() || null, html: c.cell(x) })));
      tr.addEventListener('click', () => open(x));
      tr.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(x); } });
      return tr;
    }));
    document.getElementById('count').textContent = `Showing ${rows.length} of ${runs.length} runs. Click a row for its card.`;
  }
  [q, fp, fb, fr].forEach(el => el.addEventListener('input', render));
  document.getElementById('f-reset').addEventListener('click', () => { q.value = fp.value = fb.value = fr.value = ''; render(); });

  // ---------- detail card ----------
  const dlg = document.getElementById('detail');
  function kv(pairs) { return h('dl', { class: 'kv' }, pairs.filter(Boolean).flatMap(([k, v]) => [h('dt', null, k), h('dd', { html: v })])); }
  function paired(arr, other) {
    return `right where ${other} was wrong: <b>${arr[0]}</b> · wrong where ${other} was right: <b>${arr[1]}</b> · net <b>${signed(arr[0] - arr[1])}</b>`;
  }
  function open(x) {
    document.getElementById('detail-h').textContent = x.id;
    const body = document.getElementById('detail-body');
    const blocks = [];
    if (x.submitted) blocks.push(h('p', null, h('span', { class: 'tag warn' }, 'Submitted model')));
    blocks.push(h('h3', null, 'Recipe'), kv([
      ['Phase', `${x.phase} · ${esc(phaseName[x.phase])}`],
      ['Time (PDT)', esc(x.time.replace(/^10-0(\d)/, 'Oct $1'))],
      ['Base model', `${esc(x.base)}${x.params_b ? ` · ${x.params_b} B parameters` : ''}`],
      ['Method', esc(x.method)],
      ['Data', esc(x.data)],
      ['Learning rate', lr(x.lr)],
      ['Batch', String(x.batch)],
      ['Length', x.steps ? `${x.steps} steps (max_steps)` : x.epochs ? `${x.epochs} epoch${x.epochs > 1 ? 's' : ''}` : '—'],
      ['Trainer at the time', esc(D.phases.find(p => p.id === x.phase).trainer)],
      x.test ? ['Test deployment', `<code>${esc(x.test)}</code>`] : null,
    ]));
    if (x.V) {
      blocks.push(h('h3', { style: 'margin-top:16px' }, `Validation (${int(x.V.n)} held-out train rows)`), kv([
        ['Correct', `<b>${int(x.V.correct)} / ${int(x.V.n)}</b> (${pct(x.V.correct, x.V.n, 1)})`],
        ['Untouched base, same items', `${int(x.V.base_correct)} / ${int(x.V.n)} → ${signed(x.V.correct - x.V.base_correct)} items`],
        ['Answers with <<calc>>', fix(x.V.calc_share, 3)],
        ['Mean answer length', `${int(x.V.mean_chars)} characters`],
        ['Missing #### / truncated', `${x.V.no_hash} / ${x.V.trunc}`],
      ]));
    }
    if (x.T) {
      blocks.push(h('h3', { style: 'margin-top:16px' }, `Official test (${int(x.T.n)} questions)`), kv([
        ['Correct', `<b>${int(x.T.correct)} / ${int(x.T.n)}</b> (${pct(x.T.correct, x.T.n)})`],
        ['Score', `${fix(100 * x.T.correct / x.T.n, 4)} − ${x.params_b} = <b>${fix(x.T.score, 4)}</b>`],
        x !== base ? ['vs untouched base', paired(x.T.vs_base, `the base (${int(base.T.correct)})`)] : null,
        x !== sub ? ['vs submission', paired(x.T.vs_submitted, `the submission (${int(sub.T.correct)})`)] : null,
        ['Answers with <<calc>>', fix(x.T.calc_share, 3)],
        ['Mean answer length', `${int(x.T.mean_chars)} characters`],
        ['Missing ####', `${x.T.no_hash} of ${int(x.T.n)}`],
      ]));
    }
    if (!x.V && !x.T) blocks.push(h('p', { class: 'muted', style: 'margin-top:12px' }, 'No validation or test result for this run.'));
    blocks.push(h('h3', { style: 'margin-top:16px' }, 'Verdict'), kv([
      ['Outcome', esc(x.outcome || '—')],
      ['Lesson', x.lesson ? rich(x.lesson) : '—'],
    ]));
    body.replaceChildren(...blocks);
    if (!dlg.open) dlg.showModal();
    if (location.hash !== '#' + x.id) history.replaceState(null, '', '#' + x.id);
  }
  function close() { dlg.close(); }
  dlg.addEventListener('close', () => { if (location.hash) history.replaceState(null, '', location.pathname + location.search); });
  dlg.querySelector('.close').addEventListener('click', close);
  dlg.addEventListener('click', e => { if (e.target === dlg) close(); });

  render();
  const fromHash = () => { const id = decodeURIComponent(location.hash.slice(1)); if (X.byId[id]) open(X.byId[id]); };
  window.addEventListener('hashchange', fromHash);
  fromHash();
});
