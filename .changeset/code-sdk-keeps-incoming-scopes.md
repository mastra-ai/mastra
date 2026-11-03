---
'@mastra/code-sdk': patch
---

The code agent's `scopes` function now keeps the run's incoming scopes (identity and per-message scopes) and adds the host's and the Factory session's scopes after them, matching the new Agent `scopes` function contract.
