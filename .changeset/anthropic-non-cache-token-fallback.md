---
'@mastra/observability': patch
---

Fixed Anthropic generation spans showing `0` input and output tokens in Langfuse and other OTel-based dashboards. The Anthropic Vercel AI SDK adapter sometimes reports the non-cache token counts only on `providerMetadata.anthropic`, leaving the top-level `usage` empty; Mastra now falls back to those values so the dashboards stay accurate end-to-end.

Fixes #16261.
