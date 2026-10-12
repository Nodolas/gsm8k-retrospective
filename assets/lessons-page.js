/* Lessons page: the main mistakes and what to do next time. */
HX.boot(X => {
  const { h, int, fix } = HX;
  const { sub, byId, later } = X;
  const S = sub.T;
  const t = id => int(byId[id].T.correct);
  const list = items => h('ol', { class: 'steps' }, items.map(([a, b]) => h('li', null, h('b', null, a), ' ', b)));

  const MISTAKES = [
    ['One draw of the winning recipe.', `The light LoRA was trained once on all rows before Overmind changed its trainer; afterwards the same settings scored ${t('s4-q35-4b-full-lr1e5-replica')} instead of ${int(S.correct)}, so the result could never be repeated.`],
    ['Clearing jobs to free slots.', 'The 2-job limit pushed me to clear out jobs, and the best validation run (r6) went before it was ever tested.'],
    ['A night of automation, no answers.', 'The overnight controller ran 18 small probes, none clearly above the base, and produced no test evidence.'],
    ['Many tests, no gain.', `${int(later.length + 1)} official tests after the submission; none beat ${int(S.correct)} (best ${int(X.bestAfter.T.correct)}).`],
  ];

  const NEXT = [
    ['Re-draw a winner at once,', 'several times, while the platform is unchanged.'],
    ['Never drop an untested promising model;', 'archive adapters first.'],
    ['Re-run a known reference after any platform change', 'before spending more runs.'],
    ['Gate on cheap signals:', `the share of <<calc>> answers flagged every collapse (submission ${fix(S.calc_share, 2)}, collapsed models 0.87+).`],
    ['Choose on validation, test once,', 'and settle the parameter count on day 1.'],
  ];

  document.getElementById('mistakes').append(list(MISTAKES));
  document.getElementById('next').append(list(NEXT));
});
