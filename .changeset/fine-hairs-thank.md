---
'@mastra/core': patch
'mastracode': patch
---

Reworked plan mode to use named plan files. `submit_plan` now takes the `path` to a markdown plan file you wrote (instead of a title or the plan body), so multiple plans can coexist over time and each stays on disk to review. Plan mode can write any `.md` file inside `.mastracode/plans/` (enforced by a tool guard) but nothing else, revision diffs are computed from a real LCS diff and only shown when the change is small relative to the plan, "Request Changes" stops the run immediately with no trailing model output, and diffs only compare revisions of the same plan file.
