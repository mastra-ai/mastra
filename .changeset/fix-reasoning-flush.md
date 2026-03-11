---
'@mastra/core': patch
---

`@mastra/core`: patch

Fixed reasoning content being lost in multi-turn conversations with thinking models (kimi-k2.5, DeepSeek-R1) when using OpenAI-compatible providers (e.g., OpenRouter).

Previously, reasoning content could be discarded during streaming, causing 400 errors when the model tried to continue the conversation. Multi-turn conversations now preserve reasoning content correctly across all turns.
