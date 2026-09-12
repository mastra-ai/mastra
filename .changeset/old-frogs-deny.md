---
'@mastra/github-signals': patch
---

Slimmed GitHub pull request notification records by keeping agent-facing details (title, state, CI state, comment fields, check names) in attributes only. Internal sync bookkeeping in metadata no longer duplicates those fields, so stored notifications are several KB smaller each. Failing CI checks now also include a `failingCheckUrls` attribute so agents can link directly to a failing run.
