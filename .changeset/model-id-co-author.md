---
'mastracode': minor
---

Added model name to Co-Authored-By in commit messages. Commits now include the active model (e.g. `Co-Authored-By: Mastra Code (anthropic/claude-opus-4-6) <noreply@mastra.ai>`) for traceability when switching between models. Falls back to the original static format when no model is set.
