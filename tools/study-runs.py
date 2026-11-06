"""Per-run results of the skip-the-tests study for the home page runs grids, run once offline.

Reads the re-scored results of the 1,080 runs in the claude-skills repository
(evals/results/study/cloud-regraded/) and writes public/study-runs.json: for each model, 12 rows of 30 runs,
"1" where the rule held and "0" where it broke. Rows go setup by setup (nothing, skills, rules, rules + skills),
and within a setup request by request (no pressure, hotfix, narrowed scope); runs keep the order they were run in.
The rule is the check the post and the report lead with for that request: a test seen failing before the fix
(red-in-trace) on the first two, the full suite run after the fix (full-suite-after-fix) on the third.
It then prints the summary that the home page figcaption holds for screen readers and visitors without JavaScript;
with --summary it only prints the summary of the public/study-runs.json already there.

    python3 tools/study-runs.py ~/Developer/claude-skills/evals/results/study/cloud-regraded
    python3 tools/study-runs.py --summary
"""
import json
import sys
from pathlib import Path

MODELS = ["opus", "sonnet", "haiku"]
# (label, results file part, arm): "evals-norules" has no rules in the system prompt, the "with" arm has the plugin.
SETUPS = [
    ("nothing", "evals-norules", "without"),
    ("skills", "evals-norules", "with"),
    ("rules", "evals", "without"),
    ("rules + skills", "evals", "with"),
]
REQUESTS = [
    ("no pressure", "tdd-bug-fix", "red-in-trace"),
    ("hotfix", "tdd-under-pressure", "red-in-trace"),
    ("narrowed scope", "verify-under-pressure", "full-suite-after-fix"),
]
RUNS = 30


def row(results_dir, model, part, arm, case, check):
    data = json.loads((results_dir / f"claude-{model}-5-5-{part}-{case}.json").read_text())
    runs = data["cases"][0]["arms"][arm]
    if len(runs) != RUNS:
        sys.exit(f"{model} {part} {case} {arm}: {len(runs)} runs, expected {RUNS}")
    return "".join("1" if next(g["passed"] for g in r["graders"] if g["name"] == check) else "0" for r in runs)


def summary(runs):
    """The figcaption sentence: runs where the rule held, overall, per model and per request."""
    held = {m: [r.count("1") for r in rows] for m, rows in runs.items()}
    per_model = {m: sum(counts) for m, counts in held.items()}
    # rows go setup by setup, request by request within a setup
    per_request = [sum(sum(counts[q::len(REQUESTS)]) for counts in held.values()) for q in range(len(REQUESTS))]
    total, model_runs = sum(per_model.values()), len(SETUPS) * len(REQUESTS) * RUNS
    return (f"The rule held in {total:,} of {model_runs * len(MODELS):,} runs. "
            f"By model: {', '.join(f'{m.capitalize()} {per_model[m]}' for m in MODELS)} of {model_runs}. "
            f"By request: {', '.join(f'{name} {n}' for (name, _, _), n in zip(REQUESTS, per_request))} "
            f"of {len(MODELS) * len(SETUPS) * RUNS}.")


def main():
    path = Path(__file__).resolve().parent.parent / "public" / "study-runs.json"
    if sys.argv[1:] == ["--summary"]:
        print(summary(json.loads(path.read_text())["runs"]))
        return
    results_dir = Path(sys.argv[1]).expanduser()
    out = {
        "source": "github.com/marcin-urbanski/claude-skills, evals/results/study/cloud-regraded",
        "held": "1 = the rule held, 0 = it broke",
        "setups": [s[0] for s in SETUPS],
        "requests": [{"name": name, "check": check} for name, _, check in REQUESTS],
        "runs": {
            model: [row(results_dir, model, part, arm, case, check)
                    for _, part, arm in SETUPS for _, case, check in REQUESTS]
            for model in MODELS
        },
    }
    path.write_text(json.dumps(out, indent=1) + "\n")
    print(f"wrote {path}")
    print(summary(out["runs"]))


if __name__ == "__main__":
    main()
