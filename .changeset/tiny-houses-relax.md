---
'mastracode': minor
---

Added support for `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` environment fallbacks in mastracode direct auth.

`ANTHROPIC_BASE_URL` and `OPENAI_BASE_URL` now also apply to the Anthropic and OpenAI OAuth transport paths, and `OPENAI_BASE_URL` is used as provided instead of forcing a Codex-specific path.
