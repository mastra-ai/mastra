---
'mastracode': minor
---

Fix assistant streaming updates so tool-result-only chunks do not overwrite visible assistant text with empty content.

Also add an OpenAI native `web_search` fallback when no Tavily key is configured and the current model is `openai/*`.
