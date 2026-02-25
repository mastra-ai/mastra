---
'mastracode': minor
---

Added reasoning effort support for OpenAI Codex models. The `/think` command now controls the reasoning depth (off, minimal, low, medium, high) sent to the Codex API via the `reasoningEffort` parameter. Without this, gpt-5.3-codex skips tool calls and narrates instead of acting.

**Other improvements:**

- `/think` now shows an inline selector list when run without arguments, or accepts a level directly (e.g. `/think high`)
- Switching to an OpenAI model pack auto-enables reasoning at `low` if it was off
- Updated default Codex model from gpt-5.2 to gpt-5.3
- Shows a warning when the current model doesn't support reasoning
