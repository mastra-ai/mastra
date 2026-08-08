---
'@mastra/core': patch
'@mastra/inngest': patch
---

Agent scorers now run on the Inngest durable engine.

An agent configured with `scorers` never had them executed when running via `createInngestAgent()` — no scorer ran, no spans, no persisted scores, and no error. Core's durable workflow gained an `execute-scorers` step that the Inngest workflow builder, a copy of it, never picked up.

Scorer execution now lives in the durable workflow's shared module and is used by both engines, so scorers behave identically on either one.
