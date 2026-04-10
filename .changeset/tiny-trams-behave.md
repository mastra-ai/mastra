---
'@mastra/playground-ui': patch
'mastra': patch
---

Refresh Studio Evaluation pages: flatten URLs (`/scorers`, `/datasets`, `/experiments` at top level; `/evaluation` stays as overview), and adopt the `PageLayout` / `PageHeader` primitives with page-level 401/403/error handling. Removes `EvaluationDashboard` and all `Evaluation*`-prefixed list components, option constants, and data hooks from `@mastra/playground-ui` — use the per-domain replacements (e.g. `ScorersList`, `SCORER_SOURCE_OPTIONS`, `useScorers`).
