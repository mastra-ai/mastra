---
'@mastra/sentry': patch
---

Keep exporting `MODEL_GENERATION` as the single `gen_ai.chat` span with token usage, and skip the new `MODEL_INFERENCE` spans like steps and chunks, so each model call is reported once in Sentry.
