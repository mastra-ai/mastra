---
'@mastra/code-sdk': patch
---

Auto memory now picks Gemini only when Mastra Code can use a Google credential for the request: a stored key or sign-in, or locally a `GOOGLE_GENERATIVE_AI_API_KEY` or `GOOGLE_API_KEY` environment variable. Deployed Factory accounts never use the server's environment keys, so they get a model from a provider they connected.
