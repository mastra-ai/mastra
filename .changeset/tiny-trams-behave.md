---
'@mastra/playground-ui': patch
'mastra': patch
---

Refresh Studio Evaluation pages with an updated UI and flattened top-level URLs (`/scorers`, `/datasets`, `/experiments`; `/evaluation` remains as the overview). `@mastra/playground-ui` removes `EvaluationDashboard` and all `Evaluation*`-prefixed list components, constants, and hooks — use the per-domain replacements (e.g. `ScorersList`) instead.
