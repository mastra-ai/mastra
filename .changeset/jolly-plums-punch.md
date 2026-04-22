---
'mastracode': minor
---

Added evals system for MastraCode with live scorers and an offline experiment pipeline.

**Live scorers** run automatically during sessions to grade outcomes and efficiency:
- **Outcome scorer** — checks build/test pass status, tool error rates, stuck loops, regressions, and autonomy
- **Efficiency scorer** — measures redundancy, turn count, retry efficiency, and read-before-edit patterns

**Offline experiment pipeline** for running controlled evaluations against datasets seeded from real traces:
- **Outcome-match scorer** — compares results against ground truth assertions (build passes, test passes, files modified, custom assertions)
- **Trajectory-efficiency scorer** — evaluates tool call and step counts against expected bounds
- **LLM judge scorer** — qualitative assessment of correctness and methodology

**New TUI commands:**
- `/feedback` — submit thumbs up/down and comments on traces, routed through the observability event bus so feedback reaches cloud exporters even when DuckDB is locked. Feedback is attributed to the user's git display name.
- `/experiment` — seed datasets from traces, run experiments, and view results

**Automatic error feedback** — non-retryable stream errors automatically emit a thumbs-down feedback event with the error message, enabling error tracking in the cloud dashboard without manual intervention.

**Enriched span metadata** — agent run spans now capture model configuration, agent settings, OM settings, and project context for filtering and analysis in the cloud dashboard.
