---
'mastra': patch
---

Preflight remediation for missing DB env vars now renders as a step list — one arrow line per option (`Run mastra env db create <env> --kind <kind>` on line 1, `Or set <ENV_VAR> in your env file` on line 2) — instead of a single run-on sentence that squashed both options into a wall of text.
