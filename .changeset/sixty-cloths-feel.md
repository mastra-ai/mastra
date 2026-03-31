---
'mastracode': minor
---

Added --model (-m) CLI option to headless mode, allowing users to specify which model to use for a headless run (e.g., `mastracode --prompt "Fix bug" --model anthropic/claude-sonnet-4-20250514`). The flag validates that the model exists and has an API key configured before starting.
