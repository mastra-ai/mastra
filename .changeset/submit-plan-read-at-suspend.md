---
'@mastra/code-sdk': patch
---

`submit_plan` now reads the plan file when the run suspends, so approval cards always render the plan. The tool ships as a filesystem-free builtin that only knows the plan file path and expects the host to fill in the plan, and nothing did, so the card fell back to re-reading the file later through the session workspace. That broke whenever the sandbox was recreated, the plans directory moved, or the file was edited after submission — the card showed "The plan could not be loaded from <path>" with Approve disabled, and a later read could show a different plan than the one reviewed.

Submitting a path outside the plans directory now fails immediately with the location to write instead of parking an unrenderable card. In Factory that means a repository-prefixed path like `mastra/.artifacts/plans/issue-5.md` — which resolves inside a checkout, where the Factory UI never looks — reports the plans directory at the workspace root and does not suspend. The check belongs to the SDK's own tool, so Mastra Code sessions (including the TUI) get the same rejection, where the builtin accepted any path it was given.

`approvePlanFile` now accepts the reviewed plan text and archives that, instead of re-reading the file, so the archived plan is the one the user approved.
