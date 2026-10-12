# GSM8K hackathon retrospective: score 87.2278, rank 6

> My entry to Overmind's "Small Model, Big Maths" two-day model training hackathon in San Francisco (submissions closed 2026-10-07 17:00 PDT): a light LoRA fine-tune of Qwen3.5-4B that scored 87.2278 on GSM8K (1,212/1,319 correct, 91.89%, minus 4.66 B parameters), rank 6 on the final leaderboard.

Interactive version: https://nodolas.github.io/gsm8k-retrospective/ · Raw data: https://nodolas.github.io/gsm8k-retrospective/data/history.json · Author: Nicolas Peters Saa

## Key facts

- **Final score:** 87.2278 (the board shows 87.2), rank 6 on the final leaderboard
- **Score formula:** strict-match % on GSM8K test (n = 1,319) minus total parameters in billions
- **Model:** Qwen3.5-4B with a light LoRA adapter, 4.66 B parameters, all counted
- **Training:** one pass over the 7,473 official GSM8K training problems, LR 1e-5, 48 steps
- **Test result:** 1,212/1,319 correct (91.89%); untouched base model 1,198/1,319 (score 86.17)
- **How it was chosen:** on 500 held-out validation problems before any test use: 462/500 vs 457/500 for the base
- **Training runs:** 52 in total, 17 with an official test, 40 with validation
- **After the submission:** 16 more official tests; the best reached 1,208, none beat 1,212
- **Hackathon:** Overmind "Small Model, Big Maths", two days, San Francisco; https://www.overmindlab.ai/hack
- **Author:** Nicolas Peters Saa (board name Nodolas), https://nodolas.github.io/NicolasPetersSaa/

## Final leaderboard

Top 9 of the Overmind high scores after the deadline. Other teams are listed by rank only.

| Rank | Team | Score | Correct items my 4.66 B model would need |
|---|---|---|---|
| 1 | Team #1 | 89.95 | 1,248 |
| 2 | Team #2 | 88.91 | 1,235 |
| 3 | Team #3 | 88.09 | 1,224 |
| 4 | Team #4 | 87.84 | 1,221 |
| 5 | Team #5 | 87.34 | 1,214 |
| 6 | Nodolas (me) | 87.20 | - |
| 7 | Team #7 | 87.07 | 1,210 |
| 8 | Team #8 | 86.67 | 1,205 |
| 9 | Team #9 | 86.45 | 1,202 |

## What made it better

- **Picking the 4B model** Big enough to reason well, small enough that the size penalty did not eat the gain. (validation: 2B 328/500, 4B 419/500, 9B 434/500 (but 9.65 B params))
- **Barely training it** The base model was already strong; heavy fine-tuning only made it worse. (untouched 457/500 vs fine-tuned 408–420/500)
- **A very light fine-tune** A small learning rate and only 48 steps nudged it slightly up. This is the submission. (test 1,212/1,319 vs the base 1,198/1,319)
- **Few, large steps** When retraining on the new trainer, a few large updates came closest. (x7 1,208/1,319 vs 1,058/1,319 with many small steps)

## What made it worse

- **Training harder** A higher learning rate or more steps made the answers terse and wrong. (LR 1.25e-5: 1,074/1,319)
- **Overmind's trainer change** After it, the same settings no longer produced the same model. (same recipe after the change: 1,112/1,319)
- **Full fine-tuning** Updating all the weights hurt, even at tiny learning rates. (408/500 on validation, the worst 4B)
- **Other tricks** Training on the test's prompt format and switching to Qwen3-4B did not help. (prompt format best 1,197/1,319; Qwen3-4B 127/200 vs 180/200)
- **Counting every parameter** I counted the full 4.66 B; the catalogue's 4.0 B would have ranked higher. (87.89 at 4.0 B: rank 4 instead of 6)

## The six phases

### P1: Pick the base model (Oct 5 evening)

Trainer: old (packed rows kept separate).

2B, 4B and 9B Qwen3.5 with standard LoRA SFT. The 4B won; heavy SFT made every model worse than the untouched 4B.

### P2: Light touch wins (Oct 6 morning)

Trainer: old.

LR 1e-5, one epoch, 48 packed steps: +1 pt on validation, then 1,212/1,319 on test = the submission (87.2278).

### P3: Re-rolls after the trainer change (Oct 6 afternoon-evening)

Trainer: packed rows attend to each other (Overmind commit 1be6037, 10:12 PDT).

The same recipe re-run collapsed into short `<<calc>>` answers: 1,074-1,170 on test.

### P4: Overnight probes (Oct 6 22:00 - Oct 7 09:00)

Trainer: new; 960-row subsets train unpacked.

18 automated runs on 960-row subsets (batch, LR, attention-only, Full-FT, 2 epochs; a 19th never finished): none more than 2 items above the base on 200 val items.

### P5: Other bases and full fine-tuning (Oct 7 09:30 - 13:00)

Trainer: packed until ~11:30, then everything unpacked (PR #167).

Qwen3-4B (127/200), packed light LoRA = base on test (1,198 / 1,197), unpacked LoRA and Full-FT below base.

### P6: Around the submitted recipe (Oct 7 13:00 - 17:00)

Trainer: new, unpacked.

Exact copy 1,058; 48 steps at LR 1e-5 collapsed; 48 steps at LR 5e-6 batch 16 was the best since the change: 1,198-1,208.

## Mistakes

1. **One draw of the winning recipe.** The light LoRA was trained once before Overmind changed its trainer; afterwards the same settings scored 1,112/1,319 instead of 1,212, so the result could never be repeated.
2. **Clearing jobs to free slots.** The 2-job limit pushed me to clear out jobs, and the best validation run (r6) went before it was ever tested.
3. **A night of automation, no answers.** The overnight controller ran 18 small probes, none clearly above the base, and produced no test evidence.
4. **Many tests, no gain.** 16 official tests after the submission; none beat 1,212 (best 1,208).

## What to do next time

1. Re-draw a winner at once, several times, while the platform is unchanged.
2. Never drop an untested promising model; archive adapters first.
3. Re-run a known reference after any platform change before spending more runs.
4. Gate on cheap signals: the share of <<calc>> answers flagged every collapse (submission 0.26, collapsed models 0.87+).
5. Choose on validation, test once, and settle the parameter count on day 1.

## All 52 training runs

Validation = correct out of 500 or 200 held-out training problems, with the untouched base on the same items. Official test = correct out of the 1,319 GSM8K test problems.

| Run | Phase | Base | Method | Data | LR | Validation | Official test | Outcome |
|---|---|---|---|---|---|---|---|---|
| r1-q35-2b-zs | P1 | Qwen3.5-2B | LoRA r32 | 6,973 rows | 2e-4 | 328/500 (base 457) |  | too weak |
| r3-q35-2b-zs-3ep | P1 | Qwen3.5-2B | LoRA r32 | 6,973 rows | 2e-4 | 330/500 (base 457) |  | too weak |
| r1-q35-4b-zs-bs8 | P1 | Qwen3.5-4B | LoRA r32 | 6,973 rows | 2e-4 | 419/500 (base 457) |  | beats 78.39 board at the time |
| r3-q35-4b-zs-1ep-lr1e4 | P1 | Qwen3.5-4B | LoRA r32 | 6,973 rows | 1e-4 | 416/500 (base 457) |  | same as 2 epochs |
| r3-q35-4b-zs-r64-lr1e4 | P1 | Qwen3.5-4B | LoRA r64 | 6,973 rows | 1e-4 | 420/500 (base 457) |  | no gain from rank |
| r3-q35-4b-full-1ep-lr1e5 | P1 | Qwen3.5-4B | Full fine-tune | 6,973 rows | 1e-5 | 408/500 (base 457) |  | worst 4B |
| r5-q35-9b-zs-1ep-lr1e4 | P1 | Qwen3.5-9B | LoRA r32 | 6,973 rows | 1e-4 | 434/500 (base 457) |  | score 77 (9.65 B) |
| r1-q3-4b-zs | P1 | Qwen3-4B | LoRA r32 | 6,973 rows | 2e-4 |  |  | failed x3 before step 1 |
| r0-q35-4b-untouched | P1 | Qwen3.5-4B | LoRA r32 at LR 1e-8 (= untouched) | 6,973 rows | 1e-8 | 457/500 (base 457) |  | the reference: beats every SFT run |
| r6-q35-4b-zs-1ep-lr1e6 | P2 | Qwen3.5-4B | LoRA r32 | 6,973 rows | 1e-6 | 180/200 (base 180) |  | = untouched |
| r6-q35-4b-zs-1ep-lr1e5 | P2 | Qwen3.5-4B | LoRA r32, 48 packed steps | 6,973 rows | 1e-5 | 462/500 (base 457) |  | best clean val (462/500); never tested |
| final-q35-4b-full-lr1e5 | P2 | Qwen3.5-4B | LoRA r32/a64 all-linear, 48 packed steps | 7,473 rows (all) | 1e-5 |  | 1,212/1,319, score 87.23 | SUBMITTED: 87.2278 (board 87.2, 6th) |
| final-q35-4b-full-lr1e8 | P2 | Qwen3.5-4B | LoRA r32 at LR 1e-8 (= untouched) | 7,473 rows | 1e-8 |  | 1,198/1,319, score 86.17 | control: 86.17 |
| s1-q35-4b-full-lr125e-6 | P3 | Qwen3.5-4B | LoRA r32, packed (rows attend to each other) | 7,473 rows | 1.25e-5 |  | 1,074/1,319, score 76.77 | collapsed |
| s2-q35-4b-full-lr8e-6 | P3 | Qwen3.5-4B | LoRA r32, packed | 7,473 rows | 8e-6 |  | 1,134/1,319, score 81.31 | collapsed |
| s3-q35-4b-full-r16-lr1e5 | P3 | Qwen3.5-4B | LoRA r16, packed | 7,473 rows | 1e-5 |  | 1,170/1,319, score 84.04 | partly collapsed |
| s4-q35-4b-full-lr1e5-replica | P3 | Qwen3.5-4B | exact submitted config, packed | 7,473 rows | 1e-5 |  | 1,112/1,319, score 79.65 | collapsed: 7.6 pts below the submission |
| on-full-lr2.5e-6 | P4 | Qwen3.5-4B | LoRA r32, packed | 7,473 rows | 2.5e-6 | 179/200 (base 180) |  |  |
| on-fullms-lr1e-5-ms16 | P4 | Qwen3.5-4B | LoRA r32, packed, 16 steps | 7,473 rows | 1e-5 | 175/200 (base 180) |  |  |
| on-targ960-lr1.6e-6 | P4 | Qwen3.5-4B | LoRA r32, unpacked | 960 targeted rows | 1.6e-6 | 180/200 (base 180) |  |  |
| on-targ960-lr2.08e-6 | P4 | Qwen3.5-4B | LoRA r32, unpacked | 960 targeted rows | 2.08e-6 | 175/200 (base 180) |  |  |
| on-targ960-lr3.2e-6 | P4 | Qwen3.5-4B | LoRA r32, unpacked | 960 targeted rows | 3.2e-6 | 173/200 (base 180) |  |  |
| on-targ960-lr4e-6 | P4 | Qwen3.5-4B | LoRA r32, unpacked | 960 targeted rows | 4e-6 | 169/200 (base 180) |  |  |
| on-sub960-lr4e-6 | P4 | Qwen3.5-4B | LoRA r32, unpacked | 960 stratified rows | 4e-6 | 168/200 (base 180) |  |  |
| on-sub960h40-lr4e-6 | P4 | Qwen3.5-4B | LoRA r32, unpacked | 960 rows, 40 % hard | 4e-6 | 168/200 (base 180) |  |  |
| on-sub960h40-lr2.4e-6 | P4 | Qwen3.5-4B | LoRA r32, unpacked | 960 rows, 40 % hard | 2.4e-6 | 175/200 (base 180) |  |  |
| on-sub960h40-lr1.68e-6 | P4 | Qwen3.5-4B | LoRA r32, unpacked | 960 rows, 40 % hard | 1.68e-6 | 458/500 (base 457) |  |  |
| on-targ960ep2-lr1.6e-6-ep2 | P4 | Qwen3.5-4B | LoRA r32, unpacked, 2 epochs | 960 targeted rows | 1.6e-6 | 173/200 (base 180) |  |  |
| on-targ960attn-lr4e-6-attn | P4 | Qwen3.5-4B | LoRA attention-only | 960 targeted rows | 4e-6 | 178/200 (base 180) |  |  |
| on-targ960attn-lr5.2e-6-attn | P4 | Qwen3.5-4B | LoRA attention-only | 960 targeted rows | 5.2e-6 | 181/200 (base 180) |  |  |
| on-targ960attn-lr8e-6-attn | P4 | Qwen3.5-4B | LoRA attention-only | 960 targeted rows | 8e-6 | 176/200 (base 180) |  |  |
| on-targ960b4-lr8e-7-b4 | P4 | Qwen3.5-4B | LoRA r32, batch 4 | 960 targeted rows | 8e-7 | 182/200 (base 180) |  |  |
| on-targ960b2-lr4e-7-b2 | P4 | Qwen3.5-4B | LoRA r32, batch 2 | 960 targeted rows | 4e-7 | 180/200 (base 180) |  |  |
| on-fullft960-lr2e-7-fullft | P4 | Qwen3.5-4B | Full fine-tune | 960 targeted rows | 2e-7 | 177/200 (base 180) |  |  |
| on-long960-lr2e-6 | P4 | Qwen3.5-4B | LoRA r32, unpacked | 960 longest answers | 2e-6 | 176/200 (base 180) |  |  |
| p1-q3-4b-untouched-targ960-b2 | P5 | Qwen3-4B | LoRA at LR 1e-8 (= untouched) | 960 rows | 1e-8 | 127/200 (base 180) |  | dead end |
| b1-q35-4b-r6data-lr2e-6 | P5 | Qwen3.5-4B | LoRA r32, packed | 6,973 rows | 2e-6 | 177/200 (base 180) |  | below gate |
| f1-full-lr2.5e-6-r32 | P5 | Qwen3.5-4B | LoRA r32, packed | 7,473 rows | 2.5e-6 | 180/200 (base 180) | 1,198/1,319, score 86.17 | = base on test |
| f3-full-lr5e-6-r16 | P5 | Qwen3.5-4B | LoRA r16, packed | 7,473 rows | 5e-6 | 179/200 (base 180) | 1,197/1,319, score 86.09 | = base on test |
| g1-full-b16-lr1e-6-r32 | P5 | Qwen3.5-4B | LoRA r32, unpacked, 468 steps | 7,473 rows | 1e-6 | 169/200 (base 180) |  | collapsed |
| g2-full-b16-lr5e-7-r32 | P5 | Qwen3.5-4B | LoRA r32, unpacked, 468 steps | 7,473 rows | 5e-7 | 176/200 (base 180) |  | below base |
| h2-fullft-b16-lr5e-8 | P5 | Qwen3.5-4B | Full fine-tune, unpacked | 7,473 rows | 5e-8 | 176/200 (base 180) |  | below base |
| h1-fullft-b16-lr1e-7 | P5 | Qwen3.5-4B | Full fine-tune, unpacked | 7,473 rows | 1e-7 | 174/200 (base 180) |  | below base |
| x1-exact-submitted-recipe | P6 | Qwen3.5-4B | exact submitted config (now 935 unpacked steps) | 7,473 rows | 1e-5 | 27/40 (base 34) | 1,058/1,319, score 75.55 | collapsed |
| x2-submitted-ms48-b16 | P6 | Qwen3.5-4B | submitted config, max_steps 48, batch 16 | 7,473 rows | 1e-5 | 32/40 (base 34) | 1,135/1,319, score 81.39 | collapsed |
| x3-submitted-ms48-b16-fs5 | P6 | Qwen3.5-4B | x2 on 5-shot-prompt rows | 6,973 rows (eval format) | 1e-5 | 29/40 (base 34) | 1,058/1,319, score 75.55 | collapsed |
| x4-submitted-ms48-b16-fs5-lr2.5e-6 | P6 | Qwen3.5-4B | x3 at a quarter LR | 6,973 rows (eval format) | 2.5e-6 | 33/40 (base 34) | 1,197/1,319, score 86.09 | = base |
| x5-submitted-ms48-b16-fs5-lr5e-6 | P6 | Qwen3.5-4B | x3 at half LR | 6,973 rows (eval format) | 5e-6 |  | 1,124/1,319, score 80.56 | collapsed |
| x6-submitted-ms48-b16-lr5e-6 | P6 | Qwen3.5-4B | submitted config, max_steps 48, batch 16 | 7,473 rows | 5e-6 |  | 1,205/1,319, score 86.70 | best since the trainer change until x7 |
| x7-submitted-ms48-b16-lr5e-6-r6data | P6 | Qwen3.5-4B | x6 setting | 6,973 rows | 5e-6 |  | 1,208/1,319, score 86.92 | best since the trainer change: 4 items short |
| x8-ms48-b16-lr5e-6-sub999 | P6 | Qwen3.5-4B | x6 setting | 999 stratified rows | 5e-6 |  | 1,202/1,319, score 86.47 | below |
| x9-ms48-b16-lr5e-6-sub960 | P6 | Qwen3.5-4B | x6 setting | 960 stratified rows | 5e-6 |  | 1,198/1,319, score 86.17 | = base |
