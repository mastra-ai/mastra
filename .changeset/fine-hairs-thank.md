---
'@mastra/core': patch
'mastracode': patch
---

Reworked plan mode to use named plan files. The agent writes its plan to a markdown file under `.mastracode/plans/` and calls `submit_plan` with the `path` to that file, so multiple plans stay on disk for review. The host validates the submitted path is a `.md` file inside `.mastracode/plans/` before reading it, so the tool can't be pointed at arbitrary files. Plan mode can write any `.md` file inside `.mastracode/plans/` (enforced by a tool guard) but nothing else, submitted plan snapshots are persisted for history replay, revision diffs are computed from a real line-ending-normalized LCS diff and only shown when the change is small relative to the plan, "Request Changes" stops the run immediately with no trailing model output, and diffs only compare revisions of the same plan file.
