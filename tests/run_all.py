"""Runs every check and prints PASS / FAIL for each.
Run from the salon-swap folder:  python3 tests/run_all.py"""
import subprocess, sys, pathlib, re
HERE = pathlib.Path(__file__).resolve().parent
checks = ["check_play.py", "check_rewards.py", "check_economy.py", "check_missions.py", "check_career.py"]
bad = 0
for c in checks:
    r = subprocess.run([sys.executable, str(HERE / c)], capture_output=True, text=True, timeout=900)
    out = r.stdout + r.stderr
    problems = (r.returncode != 0 or "FAIL" in out or "Traceback" in out
                or re.search(r"errors \[[^\]]", out) or re.search(r'"failures": \[\{', out)
                or re.search(r"uncaught page errors: \[[^\]]", out))
    print(("FAIL  " if problems else "PASS  ") + c)
    if problems:
        bad += 1
        print(out[-2000:])
print("\nAll checks passed." if not bad else f"\n{bad} check(s) failed.")
sys.exit(1 if bad else 0)
