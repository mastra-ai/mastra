---
"@mastra/server": patch
---

Fix `isProviderConnected` (used by Mastra Studio's "connect a provider" banner) incorrectly reporting Google as disconnected when only one of its two aliased env vars (`GOOGLE_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`) was set, and incorrectly collapsing Vertex AI provider ids (`google.vertex.chat`, `google.vertex.anthropic.chat`, `google-vertex`) into the Google AI Studio registry entry. Vertex is now checked against its own required settings (`GOOGLE_VERTEX_PROJECT` and `GOOGLE_VERTEX_LOCATION`, both unconditionally required by `@ai-sdk/google-vertex`) instead of `GOOGLE_API_KEY`. Other multi-env-var providers (e.g. Netlify, which requires both `NETLIFY_TOKEN` and `NETLIFY_SITE_ID`) are unaffected — the alias/OR behavior is scoped to Google only.
