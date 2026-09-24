---
'mastracode': patch
---

Fixed Stagehand browser automation for OpenAI Codex users: a model chosen with `/browser set model openai/...` now runs through your Codex login instead of requiring a separate `OPENAI_API_KEY`, and when no browser model is configured Stagehand reuses the chat model active at launch where possible. `/browser status` and `/browser info` explain where the model came from (configured, current chat model, Codex login default, or Stagehand default).
