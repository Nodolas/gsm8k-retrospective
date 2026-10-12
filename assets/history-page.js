/* History page: how I got to my submitted model, then the six phases on a timeline with the platform events.
   Each step is one sentence on what I did, with its key figure underneath. */
HX.boot(X => {
  const { h, int, lr, signed } = HX;
  const { sub, base, byId, valRef, N } = X;
  const S = sub.T, B = base.T;
  const r = id => byId[id];
  const v = id => `${int(r(id).V.correct)} / ${int(r(id).V.n)}`;
  const range = xs => (Math.min(...xs) === Math.max(...xs) ? int(xs[0]) : `${int(Math.min(...xs))}–${int(Math.max(...xs))}`);
  const item = (title, did, key) => h('li', null, h('h3', null, title), h('p', { class: 'did' }, did), h('p', { class: 'key' }, key));

  // ---------- how I got to the model ----------
  const sft = ['r1-q35-4b-zs-bs8', 'r3-q35-4b-zs-1ep-lr1e4', 'r3-q35-4b-zs-r64-lr1e4', 'r3-q35-4b-full-1ep-lr1e5'].map(r);
  const r6 = r('r6-q35-4b-zs-1ep-lr1e5');
  document.getElementById('path').append(h('ol', { class: 'steps' }, [
    item('Model size', 'Compared Qwen3.5 2B, 4B and 9B with the same recipe. The score subtracts parameters, so the 4B won.',
      `Validation: 2B ${v('r1-q35-2b-zs')} · 4B ${v('r1-q35-4b-zs-bs8')} · 9B ${v('r5-q35-9b-zs-1ep-lr1e4')}`),
    item('Training dose', 'Checked whether fine-tuning helps at all, using an untouched control.',
      `Untouched ${v(valRef.id)} vs fine-tuned ${range(sft.map(x => x.V.correct))} / 500`),
    item('Gentle fine-tune', 'Tried a very light LoRA: LR 1e-5, one epoch, 48 steps.',
      `${v(r6.id)} vs the base's ${int(r6.V.base_correct)} / 500`),
    item('Final model', `Retrained it on all ${sub.data.replace(' (all)', '')} and fixed the choice before using the test set.`,
      'Choice recorded 08:38 PDT, Oct 6 (commit 92ebd64)'),
    item('Result', 'Ran the official test once.',
      `${int(S.correct)} / ${int(S.n)} = ${HX.pct(S.correct, S.n)} · score ${HX.fix(S.score, 4)}`),
  ]));

  // ---------- phases ----------
  const tests = p => p.runs.filter(x => x.T && x !== base);
  const best = xs => xs.reduce((a, x) => (!a || x.T.correct > a.T.correct ? x : a), null);
  const PHASES = {
    P1: p => {
      const ft = p.runs.filter(x => x.V && x !== valRef);
      return ['Compared model sizes with standard LoRA fine-tuning, plus an untouched control.',
        `Untouched 4B ${v(valRef.id)} beat every fine-tuned run (best ${int(Math.max(...ft.map(x => x.V.correct)))} / 500)`];
    },
    P2: () => ['Trained a very light LoRA and submitted it.',
      `${int(S.correct)} / ${int(N)} on test · score ${HX.fix(S.score, 4)} · base ${int(B.correct)}`],
    P3: p => ['Re-ran the submitted recipe with small changes on the new trainer.',
      `${range(tests(p).map(x => x.T.correct))} / ${int(N)}: all below the base (${int(B.correct)})`],
    P4: p => {
      const ds = p.runs.filter(x => x.V).map(x => x.V.correct - x.V.base_correct);
      return [`Ran ${p.runs.length} automated overnight probes on small data subsets.`,
        `Best ${signed(Math.max(...ds))} items vs the base on 200 validation items; no tests`];
    },
    P5: p => ['Tried another base model (Qwen3-4B), light LoRA on all rows, and full fine-tuning.',
      `Best test ${int(best(tests(p)).T.correct)} / ${int(N)}, the same as the base`],
    P6: p => {
      const b = best(tests(p));
      return ['Spent the last hours re-tuning the submitted recipe, testing every run.',
        `Best ${int(b.T.correct)} / ${int(N)} (${b.id.split('-')[0]}), ${int(S.correct - b.T.correct)} short of the submission`];
    },
  };

  // Platform events and my own actions, placed between the phases by time.
  const EVENTS = [
    { t: Date.UTC(2026, 9, 6, 10, 12), when: 'Oct 6 10:12', text: 'Overmind changed its trainer; the submitted recipe could no longer be reproduced.' },
    { t: Date.UTC(2026, 9, 6, 17, 15), when: 'Oct 6 17:15', text: 'Deadline moved to Oct 7 17:00.' },
    { t: Date.UTC(2026, 9, 7, 17, 0), when: 'Oct 7 17:00', text: 'Deadline. The submission stays at 87.2278.' },
  ];
  const AFTER = { P2: [0, 1], P6: [2] };  // which events follow which phase

  function chip(cls, text) { return h('span', { class: `chip ${cls}` }, text); }
  const cls = d => (d > 0 ? 'up' : d < 0 ? 'down' : 'same');
  function runRow(x) {
    const res = [];
    if (x.submitted) res.push(chip('sub', 'SUBMITTED'));
    if (x.V) { const d = x.V.correct - x.V.base_correct; res.push(chip(cls(d), `val ${int(x.V.correct)}/${int(x.V.n)} ${signed(d)}`)); }
    if (x.T) { const d = x.T.correct - B.correct; res.push(chip(x.submitted ? 'sub' : cls(d), `test ${int(x.T.correct)}/${int(N)} ${x === base ? '(base)' : signed(d)}`)); }
    if (!x.V && !x.T) res.push(chip('same', x.outcome || 'no result'));
    const recipe = [x.base.replace('Qwen/', ''), x.method, `LR ${lr(x.lr)}`, `batch ${x.batch}`, HX.stepsStr(x)].join(' · ');
    return h('li', null, h('a', { class: 'rid', href: `runs.html#${x.id}` }, x.id), h('span', { class: 'res' }, res), h('span', { class: 'rec' }, recipe));
  }
  const eventItem = e => h('div', { class: 'tl-item event' }, h('div', { class: 'event-box' }, h('div', { class: 'when' }, `${e.when} PDT`), h('p', null, e.text)));

  const tl = document.getElementById('timeline');
  for (const p of X.phases) {
    const [did, key] = PHASES[p.id](p);
    tl.append(h('div', { class: 'tl-item', id: p.id },
      h('div', { class: 'panel' },
        h('div', { class: 'phase-head' }, h('span', { class: 'pid' }, p.id), h('h2', null, p.name)),
        h('div', { class: 'phase-meta' }, p.when),
        h('p', { class: 'did' }, did),
        h('p', { class: 'key' }, key),
        h('details', { class: 'tv' }, h('summary', null, `Show the ${p.runs.length} runs`), h('ul', { class: 'runlist' }, p.runs.map(runRow))))));
    for (const i of AFTER[p.id] || []) tl.append(eventItem(EVENTS[i]));
  }
});
