---
'mastracode': minor
---

Added support for `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` environment fallbacks in mastracode direct auth.

`ANTHROPIC_BASE_URL` and `OPENAI_BASE_URL` now also apply to the Anthropic and OpenAI OAuth transport paths, so compatible proxies can handle both direct API and OAuth-backed requests.
