---
'mastracode': minor
---

Added evals system for MastraCode with live scorers that run automatically during sessions.

**Live scorers** grade outcomes and efficiency:
- **Outcome scorer** — checks build/test pass status, tool error rates, stuck loops, regressions, and autonomy
- **Efficiency scorer** — measures redundancy, turn count, retry efficiency, and read-before-edit patterns

**New TUI command:**
- `/feedback` — submit thumbs up/down and comments on traces, routed through the observability event bus so feedback reaches cloud exporters even when DuckDB is locked. Feedback is attributed to the user's git display name.

**Automatic error feedback** — non-retryable stream errors automatically emit a thumbs-down feedback event with the error message, enabling error tracking in the cloud dashboard without manual intervention.

**New TUI command:**
- `/observability` — configure per-resource cloud observability project ID and access token. Credentials are stored securely in `auth.json` (0600 permissions) and project IDs in `settings.json`. No environment variables required.

**Enriched span metadata** — agent run spans now capture model configuration, agent settings, OM settings, and project context for filtering and analysis in the cloud dashboard.
