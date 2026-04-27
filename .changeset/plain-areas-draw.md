---
'@mastra/core': patch
---

Fixed tool `strict: true` being silently dropped when routing through V2 (AI SDK v5) OpenAI providers. V2 providers use a global `strictJsonSchema` provider option instead of per-tool `strict`, so Mastra now propagates the intent automatically — when any tool on a call has `strict: true`, `providerOptions.openai.strictJsonSchema` is set to `true` before the request is sent. Explicit user-supplied `strictJsonSchema` values are respected and never overridden.
