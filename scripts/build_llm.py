"""Make the retrospective readable by LLMs and agents that do not run JavaScript.

Reads data/history.json and writes:
  retrospective.md  the whole retrospective as one Markdown file
  llms.txt          llmstxt.org index pointing at it
and refreshes, between <!-- llm:... --> markers in every page,
  a <link rel="alternate" type="text/markdown"> plus JSON-LD in <head>, and
  a plain-HTML copy of the page's facts in a <details> block at the end of <main>.

Run from the repo root:  python scripts/build_llm.py
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = "https://nodolas.github.io/gsm8k-retrospective/"
AUTHOR = {"@type": "Person", "name": "Nicolas Peters Saa", "url": "https://nodolas.github.io/NicolasPetersSaa/"}
HACK_URL = "https://www.overmindlab.ai/hack"
N = 1319

D = json.loads((ROOT / "data/history.json").read_text(encoding="utf-8"))
runs = D["runs"]
by = {r["id"]: r for r in runs}
sub = next(r for r in runs if r.get("submitted"))
base = next(r for r in runs if r.get("test_result") and not r.get("submitted")
            and r["test_result"]["vs_base"] == [0, 0])
tested = [r for r in runs if r.get("test_result")]
after = [r for r in tested if r["phase"] not in ("P1", "P2")]
best_after = max(after, key=lambda r: r["test_result"]["correct"])
val_ref = next(r for r in runs if r.get("val_result") and r["val_result"]["n"] == 500
               and r["val_result"]["correct"] == r["val_result"]["base_correct"]
               and r["lr"] <= 1e-8 and r["base"] == sub["base"])
S, B, P = sub["test_result"], base["test_result"], sub["params_b"]
board = D["leaderboard_final"]


def n(x):
    return f"{x:,}"


def v(rid):
    vr = by[rid]["val_result"]
    return f"{vr['correct']}/{vr['n']}"


def t(rid):
    return f"{n(by[rid]['test_result']['correct'])}/{n(N)}"


def lr(x):
    m, e = f"{x:e}".split("e")
    return f"{float(m):g}e{int(e)}"


def items_for(score):
    """Correct test items a P-billion model needs to reach `score`."""
    import math
    return math.ceil((score + P) * N / 100 - 1e-6)


sft4b = [by[i]["val_result"]["correct"] for i in
         ("r1-q35-4b-zs-bs8", "r3-q35-4b-zs-1ep-lr1e4", "r3-q35-4b-zs-r64-lr1e4", "r3-q35-4b-full-1ep-lr1e5")]
at40 = 100 * S["correct"] / N - 4.0
rank40 = sum(1 for b in board if b["team"] != "Nodolas" and b["score"] > at40) + 1
later_tests = len(tested) - 1  # every official test after the submission, incl. the base control

SUMMARY = (f"My entry to Overmind's \"Small Model, Big Maths\" two-day model training hackathon in San Francisco "
           f"(submissions closed 2026-10-07 17:00 PDT): a light LoRA fine-tune of Qwen3.5-4B that scored "
           f"{S['score']:.4f} on GSM8K ({n(S['correct'])}/{n(N)} correct, {100 * S['correct'] / N:.2f}%, minus "
           f"{P} B parameters), rank {D['submission']['board_rank']} on the final leaderboard.")

FACTS = [
    ("Final score", f"{S['score']:.4f} (the board shows {D['submission']['board_shows']}), rank {D['submission']['board_rank']} on the final leaderboard"),
    ("Score formula", D["score_formula"]),
    ("Model", f"Qwen3.5-4B with a light LoRA adapter, {P} B parameters, all counted"),
    ("Training", f"one pass over the 7,473 official GSM8K training problems, LR {lr(sub['lr'])}, 48 steps"),
    ("Test result", f"{n(S['correct'])}/{n(N)} correct ({100 * S['correct'] / N:.2f}%); untouched base model {n(B['correct'])}/{n(N)} (score {B['score']:.2f})"),
    ("How it was chosen", f"on 500 held-out validation problems before any test use: {v('r6-q35-4b-zs-1ep-lr1e5')} vs {v(val_ref['id'])} for the base"),
    ("Training runs", f"{len(runs)} in total, {len(tested)} with an official test, {sum(1 for r in runs if r.get('val_result'))} with validation"),
    ("After the submission", f"{later_tests} more official tests; the best reached {n(best_after['test_result']['correct'])}, none beat {n(S['correct'])}"),
    ("Hackathon", f"Overmind \"Small Model, Big Maths\", two days, San Francisco; {HACK_URL}"),
    ("Author", f"{AUTHOR['name']} (board name Nodolas), {AUTHOR['url']}"),
]

HELPED = [
    ("Picking the 4B model", "Big enough to reason well, small enough that the size penalty did not eat the gain.",
     f"validation: 2B {v('r1-q35-2b-zs')}, 4B {v('r1-q35-4b-zs-bs8')}, 9B {v('r5-q35-9b-zs-1ep-lr1e4')} (but {by['r5-q35-9b-zs-1ep-lr1e4']['params_b']} B params)"),
    ("Barely training it", "The base model was already strong; heavy fine-tuning only made it worse.",
     f"untouched {v(val_ref['id'])} vs fine-tuned {min(sft4b)}–{max(sft4b)}/500"),
    ("A very light fine-tune", "A small learning rate and only 48 steps nudged it slightly up. This is the submission.",
     f"test {t(sub['id'])} vs the base {t(base['id'])}"),
    ("Few, large steps", "When retraining on the new trainer, a few large updates came closest.",
     f"x7 {t(best_after['id'])} vs {t('x1-exact-submitted-recipe')} with many small steps"),
]
HURT = [
    ("Training harder", "A higher learning rate or more steps made the answers terse and wrong.",
     f"LR 1.25e-5: {t('s1-q35-4b-full-lr125e-6')}"),
    ("Overmind's trainer change", "After it, the same settings no longer produced the same model.",
     f"same recipe after the change: {t('s4-q35-4b-full-lr1e5-replica')}"),
    ("Full fine-tuning", "Updating all the weights hurt, even at tiny learning rates.",
     f"{v('r3-q35-4b-full-1ep-lr1e5')} on validation, the worst 4B"),
    ("Other tricks", "Training on the test's prompt format and switching to Qwen3-4B did not help.",
     f"prompt format best {t('x4-submitted-ms48-b16-fs5-lr2.5e-6')}; Qwen3-4B {v('p1-q3-4b-untouched-targ960-b2')} vs {by['p1-q3-4b-untouched-targ960-b2']['val_result']['base_correct']}/200"),
    ("Counting every parameter", f"I counted the full {P} B; the catalogue's 4.0 B would have ranked higher.",
     f"{at40:.2f} at 4.0 B: rank {rank40} instead of {D['submission']['board_rank']}"),
]
MISTAKES = [
    ("One draw of the winning recipe.", f"The light LoRA was trained once before Overmind changed its trainer; afterwards the same settings scored {t('s4-q35-4b-full-lr1e5-replica')} instead of {n(S['correct'])}, so the result could never be repeated."),
    ("Clearing jobs to free slots.", "The 2-job limit pushed me to clear out jobs, and the best validation run (r6) went before it was ever tested."),
    ("A night of automation, no answers.", "The overnight controller ran 18 small probes, none clearly above the base, and produced no test evidence."),
    ("Many tests, no gain.", f"{later_tests} official tests after the submission; none beat {n(S['correct'])} (best {n(best_after['test_result']['correct'])})."),
]
NEXT = [
    "Re-draw a winner at once, several times, while the platform is unchanged.",
    "Never drop an untested promising model; archive adapters first.",
    "Re-run a known reference after any platform change before spending more runs.",
    f"Gate on cheap signals: the share of <<calc>> answers flagged every collapse (submission {S['calc_share']:.2f}, collapsed models 0.87+).",
    "Choose on validation, test once, and settle the parameter count on day 1.",
]


def run_rows():
    for r in runs:
        tr, vr = r.get("test_result"), r.get("val_result")
        yield [r["id"], r["phase"], r["base"].replace("Qwen/", ""), r["method"], r["data"],
               lr(r["lr"]) if r.get("lr") is not None else "",
               f"{vr['correct']}/{vr['n']} (base {vr['base_correct']})" if vr else "",
               f"{n(tr['correct'])}/{n(N)}, score {tr['score']:.2f}" if tr else "",
               r.get("outcome", "")]


RUN_HEAD = ["Run", "Phase", "Base", "Method", "Data", "LR", "Validation", "Official test", "Outcome"]


# ---------- Markdown ----------
def md_table(head, rows):
    esc = lambda s: str(s).replace("|", "\\|").replace("\n", " ")
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    out += ["| " + " | ".join(esc(c) for c in row) + " |" for row in rows]
    return "\n".join(out)


md = [f"# GSM8K hackathon retrospective: score {S['score']:.4f}, rank {D['submission']['board_rank']}", "",
      f"> {SUMMARY}", "",
      f"Interactive version: {SITE} · Raw data: {SITE}data/history.json · Author: {AUTHOR['name']}", "",
      "## Key facts", ""]
md += [f"- **{k}:** {val}" for k, val in FACTS]
md += ["", "## Final leaderboard", "",
       "Top 9 of the Overmind high scores after the deadline. Other teams are listed by rank only.", "",
       md_table(["Rank", "Team", "Score", "Correct items my 4.66 B model would need"],
                [[b["rank"], "Nodolas (me)" if b["team"] == "Nodolas" else b["team"], f"{b['score']:.2f}",
                  "-" if b["team"] == "Nodolas" else n(items_for(b["score"]))] for b in board]),
       "", "## What made it better", ""]
md += [f"- **{a}** {b} ({c})" for a, b, c in HELPED]
md += ["", "## What made it worse", ""]
md += [f"- **{a}** {b} ({c})" for a, b, c in HURT]
md += ["", "## The six phases", ""]
for p in D["phases"]:
    md += [f"### {p['id']}: {p['name']} ({p['when']})", "", f"Trainer: {p['trainer']}.", "", p["summary"], ""]
md += ["## Mistakes", ""]
md += [f"{i}. **{a}** {b}" for i, (a, b) in enumerate(MISTAKES, 1)]
md += ["", "## What to do next time", ""]
md += [f"{i}. {x}" for i, x in enumerate(NEXT, 1)]
md += ["", f"## All {len(runs)} training runs", "",
       "Validation = correct out of 500 or 200 held-out training problems, with the untouched base on the same items. "
       f"Official test = correct out of the {n(N)} GSM8K test problems.", "",
       md_table(RUN_HEAD, run_rows()), ""]
(ROOT / "retrospective.md").write_text("\n".join(md), encoding="utf-8", newline="\n")

llms = [f"# GSM8K hackathon retrospective (Nicolas Peters Saa)", "", f"> {SUMMARY}", "",
        "Everything on this site is also available as one Markdown file; prefer it over the HTML pages, "
        "which draw their numbers with JavaScript.", "",
        "## Docs", "",
        f"- [Full retrospective (Markdown)]({SITE}retrospective.md): key facts, leaderboard, what helped and hurt, phases, mistakes, all {len(runs)} runs",
        f"- [Run data (JSON)]({SITE}data/history.json): every run with recipe, validation and test results", "",
        "## Pages", "",
        f"- [Overview]({SITE}index.html): final score, leaderboard, headline charts, the submitted model",
        f"- [History]({SITE}history.html): how I got to the model and the six phases",
        f"- [Runs]({SITE}runs.html): sortable table of all runs",
        f"- [Lessons]({SITE}lessons.html): mistakes and what to do next time", "",
        "## Optional", "",
        f"- [Hackathon page]({HACK_URL})",
        f"- [Author's site]({AUTHOR['url']})", ""]
(ROOT / "llms.txt").write_text("\n".join(llms), encoding="utf-8", newline="\n")


# ---------- static HTML inside the pages ----------
e = html.escape


def ul(items):
    return "<ul>" + "".join(f"<li>{x}</li>" for x in items) + "</ul>"


def h_table(head, rows):
    return ("<div class=\"table-wrap\"><table><thead><tr>" + "".join(f"<th>{e(c)}</th>" for c in head) +
            "</tr></thead><tbody>" + "".join("<tr>" + "".join(f"<td>{e(str(c))}</td>" for c in row) + "</tr>" for row in rows) +
            "</tbody></table></div>")


facts_html = ul(f"<b>{e(k)}:</b> {e(val)}" for k, val in FACTS)
story_html = ("<h3>What made it better</h3>" + ul(f"<b>{e(a)}</b> {e(b)} ({e(c)})" for a, b, c in HELPED) +
              "<h3>What made it worse</h3>" + ul(f"<b>{e(a)}</b> {e(b)} ({e(c)})" for a, b, c in HURT))
phases_html = "".join(f"<h3>{e(p['id'])}: {e(p['name'])} ({e(p['when'])})</h3><p>{e(p['summary'])} Trainer: {e(p['trainer'])}.</p>"
                      for p in D["phases"])
lessons_html = ("<h3>Mistakes</h3><ol>" + "".join(f"<li><b>{e(a)}</b> {e(b)}</li>" for a, b in MISTAKES) + "</ol>"
                "<h3>What to do next time</h3><ol>" + "".join(f"<li>{e(x)}</li>" for x in NEXT) + "</ol>")
board_html = h_table(["Rank", "Team", "Score"],
                     [[b["rank"], "Nodolas (me)" if b["team"] == "Nodolas" else b["team"], f"{b['score']:.2f}"] for b in board])

PAGES = {
    "index.html": ("Overview", f"<p>{e(SUMMARY)}</p>" + facts_html + "<h3>Final leaderboard</h3>" + board_html + story_html),
    "history.html": ("History", f"<p>{e(SUMMARY)}</p>" + phases_html),
    "runs.html": ("Runs", f"<p>{e(SUMMARY)}</p>" + h_table(RUN_HEAD, run_rows())),
    "lessons.html": ("Lessons", f"<p>{e(SUMMARY)}</p>" + lessons_html),
}

JSONLD = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": f"GSM8K hackathon retrospective: score {S['score']:.4f}, rank {D['submission']['board_rank']}",
    "description": SUMMARY,
    "url": SITE,
    "inLanguage": "en",
    "author": AUTHOR,
    "keywords": ["GSM8K", "LoRA", "fine-tuning", "Qwen3.5-4B", "small language models", "math reasoning", "hackathon", "Overmind"],
    "about": {"@type": "Event", "name": "Overmind \"Small Model, Big Maths\" hackathon", "url": HACK_URL,
              "location": {"@type": "Place", "name": "San Francisco"},
              "organizer": {"@type": "Organization", "name": "Overmind", "url": "https://www.overmindlab.ai/"}},
    "encoding": [{"@type": "MediaObject", "contentUrl": f"{SITE}retrospective.md", "encodingFormat": "text/markdown"}],
    "isBasedOn": {"@type": "Dataset", "name": "All training runs", "url": f"{SITE}data/history.json",
                  "encodingFormat": "application/json"},
}


def replace_block(s, name, new, anchor):
    pat = re.compile(rf"<!-- llm:{name} -->.*?<!-- /llm:{name} -->\n?", re.S)
    block = f"<!-- llm:{name} -->\n{new}\n<!-- /llm:{name} -->\n"
    if pat.search(s):
        return pat.sub(lambda _: block, s)
    assert anchor in s, anchor
    return s.replace(anchor, block + anchor, 1)


for page, (label, body) in PAGES.items():
    path = ROOT / page
    s = path.read_text(encoding="utf-8")
    head = (f'<link rel="alternate" type="text/markdown" href="retrospective.md" title="Full retrospective as Markdown">\n'
            f'<link rel="canonical" href="{SITE}{"" if page == "index.html" else page}">')
    if page == "index.html":
        head += '\n<script type="application/ld+json">' + json.dumps(JSONLD, ensure_ascii=False) + "</script>"
    s = replace_block(s, "head", head, "</head>")
    s = replace_block(s, "text", (
        f'<details class="plain-text panel"><summary>{e(label)} as plain text (for screen readers, LLMs and agents)</summary>\n'
        f'{body}\n<p>All of it in one file: <a href="retrospective.md">retrospective.md</a> · '
        f'<a href="llms.txt">llms.txt</a> · <a href="data/history.json">data/history.json</a></p></details>'), "</main>")
    s = s.replace("<p class=\"err\">These pages draw their numbers from data/history.json with JavaScript. Please enable it.</p>",
                  "<p class=\"err\">These pages draw their charts with JavaScript. The plain-text version at the bottom and "
                  "<a href=\"retrospective.md\">retrospective.md</a> work without it.</p>")
    path.write_text(s, encoding="utf-8", newline="\n")

print("wrote retrospective.md, llms.txt and the plain-text blocks in", ", ".join(PAGES))
