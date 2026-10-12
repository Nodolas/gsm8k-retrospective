/* Overview page: final score, final board, the 30-second story, two headline charts and the submitted model. */
HX.boot(X => {
  const { h, int, pct, fix, lr, esc, C } = HX;
  const { D, sub, base, bestAfter, later, board, us, byId, N } = X;
  const S = sub.T, B = base.T, P = sub.params_b;

  // ---------- hero ----------
  document.getElementById('hero').append(
    h('div', { class: 'score-card' },
      h('div', { class: 'label' }, 'Final score'),
      h('div', { class: 'big' }, fix(D.submission.score, 4)),
      h('p', null, `${int(S.correct)} / ${int(S.n)} correct (${pct(S.correct, S.n)}) − ${P} B parameters`),
      h('span', { class: 'rank' }, `Rank ${D.submission.board_rank} · board shows ${D.submission.board_shows}`)),
    h('div', { class: 'grid two' },
      tile('Untouched base model', `${int(B.correct)} / ${int(B.n)}`, `score ${fix(B.score)} · the reference for every run`),
      tile('Best run after the trainer change', `${int(bestAfter.T.correct)} / ${int(bestAfter.T.n)}`,
        `${bestAfter.id.split('-')[0]} · score ${fix(bestAfter.T.score)} · ${int(S.correct - bestAfter.T.correct)} items short`),
      tile('Training runs', int(X.runs.length), `${X.tested.length} with an official test, ${X.runs.filter(r => r.V).length} with validation`),
      tile('Official tests after the submission', int(later.length + 1),
        `incl. the base control; best ${int(bestAfter.T.correct)}, none beat ${int(S.correct)}`)));
  document.getElementById('formula').textContent = `Score = ${D.score_formula}.`;

  function tile(k, v, s) {
    return h('div', { class: 'tile' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), h('div', { class: 's' }, s));
  }

  // ---------- final board ----------
  const boardRows = board.map(b => {
    const isUs = b === us;
    const gap = b.score - D.submission.score;
    const need = HX.itemsFor(b.score, P);
    return h('tr', { class: isUs ? 'us' : null },
      h('td', { class: 'num' }, String(b.rank)),
      h('td', null, isUs ? `${b.team} (me)` : b.team),
      h('td', { class: 'num' }, fix(b.score)),
      h('td', { class: 'num' }, isUs ? '—' : gap > 0 ? `+${fix(gap)}` : `${fix(gap)}`),
      h('td', { class: 'num' }, isUs ? `${int(S.correct)} (mine)` : gap > 0 ? `${int(need)} (+${int(need - S.correct)})` : 'below me'));
  });
  document.getElementById('board').append(h('div', { class: 'table-wrap' }, h('table', null,
    h('thead', null, h('tr', null, h('th', { class: 'num' }, '#'), h('th', null, 'Team'), h('th', { class: 'num' }, 'Score'),
      h('th', { class: 'num' }, 'Gap to me'), h('th', { class: 'num' }, `Test items needed at ${P} B`))),
    h('tbody', null, boardRows))));
  const above = board.filter(b => b.score > D.submission.score);
  document.getElementById('board-note').innerHTML =
    `Gap = their board score − my ${fix(D.submission.score, 4)} (the board rounds mine to ${D.submission.board_shows}). ` +
    `“Items needed” = correct answers out of ${int(N)} that my ${P} B model would need to reach that score; one item is worth ${fix(100 / N, 3)} points. ` +
    `Closest: ${esc(above[above.length - 1].team)}, ${int(HX.itemsFor(above[above.length - 1].score, P) - S.correct)} items away; the winner ${int(HX.itemsFor(above[0].score, P) - S.correct)}.`;

  // ---------- story in 30 seconds ----------
  const r = id => byId[id];
  const v = id => `${int(r(id).V.correct)}/${int(r(id).V.n)}`;
  const t = id => `${int(r(id).T.correct)}/${int(N)}`;
  const sft4b = ['r1-q35-4b-zs-bs8', 'r3-q35-4b-zs-1ep-lr1e4', 'r3-q35-4b-zs-r64-lr1e4', 'r3-q35-4b-full-1ep-lr1e5'].map(r);
  const range = (xs, f) => `${int(Math.min(...xs.map(f)))}–${int(Math.max(...xs.map(f)))}`;
  const nine = r('r5-q35-9b-zs-1ep-lr1e4');
  const at40 = HX.scoreAt(S.correct, 4.0);
  const rankAt = sc => board.filter(b => b !== us && b.score > sc).length + 1;
  const better = [
    ['Picking the 4B model', 'Big enough to reason well, small enough that the size penalty did not eat the gain.',
      `Validation: 2B ${v('r1-q35-2b-zs')} · 4B ${v('r1-q35-4b-zs-bs8')} · 9B ${v(nine.id)} (but ${nine.params_b} B params)`],
    ['Barely training it', 'The base model was already strong; heavy fine-tuning only made it worse.',
      `Untouched ${v(X.valRef.id)} vs fine-tuned ${range(sft4b, x => x.V.correct)}/500`],
    ['A very light fine-tune', 'A small learning rate and only 48 steps nudged it slightly up. This is my submission.',
      `Test ${t(sub.id)} vs the base ${t(base.id)}`],
    ['Few, large steps', 'When I had to retrain on the new trainer, a few large updates came closest.',
      `x7 ${t(bestAfter.id)} vs ${t('x1-exact-submitted-recipe')} with many small steps`],
  ];
  const worse = [
    ['Training harder', 'A higher learning rate or more steps made the answers terse and wrong.',
      `LR 1.25e-5: ${t('s1-q35-4b-full-lr125e-6')}`],
    ['Overmind’s trainer change', 'After it, the same settings no longer produced the same model.',
      `Same recipe after the change: ${t('s4-q35-4b-full-lr1e5-replica')}`],
    ['Full fine-tuning', 'Updating all the weights hurt, even at tiny learning rates.',
      `${v('r3-q35-4b-full-1ep-lr1e5')} on validation, the worst 4B`],
    ['Other tricks', 'Training on the test’s prompt format and switching to Qwen3-4B did not help.',
      `Prompt format best ${t('x4-submitted-ms48-b16-fs5-lr2.5e-6')} · Qwen3-4B ${v('p1-q3-4b-untouched-targ960-b2')} vs ${int(r('p1-q3-4b-untouched-targ960-b2').V.base_correct)}/200`],
    ['Counting every parameter', `I counted the full ${P} B; the catalogue’s 4.0 B would have ranked higher.`,
      `${fix(at40)} at 4.0 B: rank ${rankAt(at40)} instead of ${D.submission.board_rank}`],
  ];
  const li = ([b, e, k]) => h('li', null, h('b', null, b), h('span', { class: 'ev' }, e), h('span', { class: 'fig' }, k));
  document.getElementById('story-body').append(
    h('p', { class: 'story-intro' }, 'The whole hack in two lists: what pushed my score up and what pulled it down. ' +
      'Each block says what happened in one line, with the key number underneath (test = correct out of 1,319, validation = out of 500 or 200).'),
    h('div', { class: 'story-cols' },
      h('div', { class: 'better' }, h('h3', null, '▲ Made it better'), h('ul', null, better.map(li))),
      h('div', { class: 'worse' }, h('h3', null, '▼ Made it worse'), h('ul', null, worse.map(li)))));
  const dlg = document.getElementById('story');
  document.getElementById('story-open').addEventListener('click', () => dlg.showModal());
  dlg.querySelector('.close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });

  // ---------- charts ----------
  // Both charts share the y axis (correct test answers) and the same three kinds of dot.
  const yTest = { domain: [1040, 1225], ticks: [1050, 1100, 1150, 1200], fmt: int, label: `correct of ${int(N)}` };
  const refLines = [
    { y: S.correct, color: C.sub, label: `submission ${int(S.correct)}` },
    { y: B.correct, color: C.base, label: `base ${int(B.correct)}`, below: true },
  ];
  const dotLegend = [
    { shape: 'diamond', color: C.sub, label: 'my submission' },
    { shape: 'circle', color: C.base, label: 'untouched base model' },
    { shape: 'circle', color: C.a, label: 'later models' },
  ];
  const look = rr => rr === base ? { color: C.base, shape: 'circle', z: 1 } : rr === sub ? { color: C.sub, shape: 'diamond', z: 3, r: 6.5 } : { color: C.a, shape: 'circle', z: 2 };
  const others = X.later.filter(x => x !== base);
  const set = (id, html) => { document.getElementById(id).innerHTML = html; };

  // 1. every official test, in the order the tests ran
  const tested = X.tested.slice().sort((a, b) => a.t - b.t);
  const before = tested.filter(x => ['P1', 'P2'].includes(x.phase)).length;  // trained on the old trainer
  set('tests-sub', `After Overmind changed its trainer, I tested ${int(others.length)} more models. The best reached ${int(bestAfter.T.correct)}, ${int(S.correct - bestAfter.T.correct)} short of my ${int(S.correct)}.`);
  set('tests-how', `<b>How to read:</b> each dot is one model’s official test result, left to right in the order the tests ran. Higher is better. Dots right of box <b>T</b> were trained after the trainer change.`);
  HX.plot(document.getElementById('chart-tests'), {
    title: 'Official test results in the order the tests ran',
    height: 300,
    x: { domain: [0.2, tested.length + 0.8], ticks: [], fmt: String, label: 'tests in order →' },
    y: yTest, hlines: refLines.map(l => Object.assign({}, l, { labelX: 5 })),
    vlines: [{ x: before + 0.5, badge: 'T' }],
    legend: dotLegend,
    points: tested.map((x, i) => Object.assign(look(x), {
      x: i + 1, y: x.T.correct, tip: HX.runTip(x, `Finished ${x.time.replace(/^10-0(\d)/, 'Oct $1')} PDT`), href: `runs.html#${x.id}`,
    })),
  });
  document.getElementById('chart-tests').after(HX.tableView(
    [{ label: 'Run' }, { label: 'Finished (PDT)' }, { label: 'Correct', num: true }, { label: 'Score', num: true }],
    tested.map(x => [esc(x.id), x.time, int(x.T.correct), fix(x.T.score)]), 'Show the data'));

  // 2. test result against the share of answers written in <<calc>> shorthand
  set('calc-sub', `GSM8K worked answers mark sums as &lt;&lt;calc&gt;&gt;. Models that copied that shorthand into most answers lost accuracy. My submission used it least: ${fix(S.calc_share, 2)} vs ${fix(B.calc_share, 2)} for the base.`);
  set('calc-how', `<b>How to read:</b> each dot is one tested model. Left to right: the share of its answers that contain <<calc>>. Up: correct answers. Top left is best.`.replace(/<<calc>>/g, '&lt;&lt;calc&gt;&gt;'));
  HX.plot(document.getElementById('chart-calc'), {
    title: 'Test result against the share of answers using <<calc>>',
    height: 300,
    x: { domain: [0.2, 1.0], ticks: [0.2, 0.4, 0.6, 0.8, 1.0], fmt: v => v.toFixed(1), label: 'share of answers with <<calc>> →' },
    y: yTest, hlines: refLines, legend: dotLegend,
    points: X.tested.map(x => Object.assign(look(x), {
      x: x.T.calc_share, y: x.T.correct, tip: HX.runTip(x, `<<calc>> share <b>${fix(x.T.calc_share, 2)}</b>`), href: `runs.html#${x.id}`,
    })),
  });
  document.getElementById('chart-calc').after(HX.tableView(
    [{ label: 'Run' }, { label: '<<calc>> share', num: true }, { label: 'Correct', num: true }],
    X.tested.slice().sort((a, b) => a.T.calc_share - b.T.calc_share).map(x => [esc(x.id), fix(x.T.calc_share, 2), int(x.T.correct)]), 'Show the data'));

  // ---------- the submitted model ----------
  const kv = [
    ['Model', `${sub.base.replace('Qwen/', '')} with a light LoRA adapter · ${P} B parameters, all counted`],
    ['Training', `One pass over the 7,473 official training problems · LR ${lr(sub.lr)} · 48 steps`],
    ['How I chose it', `On validation, before touching the test set: ${v('r6-q35-4b-zs-1ep-lr1e5')} vs ${v(X.valRef.id)} for the base`],
    ['Test result', `${int(S.correct)} / ${int(S.n)} correct (${pct(S.correct, S.n)}) · base ${int(B.correct)}`],
    ['Score', `${fix(100 * S.correct / S.n, 2)} − ${P} = ${fix(S.score, 4)} · rank ${D.submission.board_rank}`],
    ['Availability', 'Not published; the adapter is kept privately.'],
  ];
  document.getElementById('submission').append(h('dl', { class: 'kv' }, kv.flatMap(([k, val]) => [h('dt', null, k), h('dd', null, val)])));
});
