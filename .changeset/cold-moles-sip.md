---
'mastra': minor
---

Added skills installation support to create-mastra CLI. Users can now install official Mastra agent skills during project creation with an interactive multi-select prompt. The prompt shows 10 popular agents (Claude Code, Cursor, Windsurf, etc.) by default, with an option to expand and view all 40 supported agents. The new --skills flag accepts comma-separated agent names (e.g., `--skills claude-code,cursor`) for non-interactive setup.
