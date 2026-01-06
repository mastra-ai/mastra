---
"@mastra/server": patch
"@mastra/hono": patch
"@mastra/express": patch
---

The `stream` API endpoint now automatically redacts `request` data from stream chunks (`step-start`, `step-finish`, `finish`) which could contain system prompts, tool definitions, and API keys. Redaction is enabled by default and can be disabled for debugging/internal services via `streamOptions.redact`.
