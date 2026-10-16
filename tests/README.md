# Tests

Browser checks that play the real game in a hidden Chromium window.

```
pip install playwright
python3 -m playwright install chromium
python3 tests/run_all.py
```

| File | What it checks |
|---|---|
| `check_play.py` | Auto-plays about 68 levels across all worlds and checks the board after every move, then forces errors mid-move to prove the freeze safety net repairs and unlocks the board. |
| `check_rewards.py` | Boss-board and world-clear booster rewards (first win only). |
| `check_economy.py` | Coins and gems: back pay, payouts, caps, every shop purchase, coin packs, buying +5 on the lose screen. |
| `check_missions.py` | Call Sheet: sheet generation, real-play progress, claiming, That's a wrap!, bonus mission, 48-hour reset. |
| `check_career.py` | Career Track: all 150 challenges, promotions, streak reset, win-screen card, finishing level 150. |

Screenshots from a run land in `tests/out/` (not saved to GitHub).
