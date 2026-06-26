---
'@mastra/core': patch
'mastracode': patch
---

Reworked plan mode to use named plan files. `submit_plan` now takes only the plan title, and Mastra Code derives the matching `.mastracode/plans/<slug>.md` file to avoid user-controlled path reads while still keeping multiple plans on disk for review. Plan mode can write any `.md` file inside `.mastracode/plans/` (enforced by a tool guard) but nothing else, submitted plan snapshots are persisted for history replay, revision diffs are computed from a real line-ending-normalized LCS diff and only shown when the change is small relative to the plan, "Request Changes" stops the run immediately with no trailing model output, and diffs only compare revisions of the same plan file.
