---
'@mastra/evals': patch
---

Fixed `checks.matches()` with `exact: true` for patterns with alternatives. `checks.matches(/yes|no/, { exact: true })` now scores 0 for "yes, but only on Tuesdays" and "I said no", which scored 1 before.
