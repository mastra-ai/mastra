---
'@mastra/core': patch
---

Fix reasoning content lost in multi-turn requests with thinking models (kimi-k2.5, DeepSeek-R1, OpenRouter) via OpenAI-compatible providers.

Some providers emit `tool-input-start` before `reasoning-end`, causing accumulated reasoning deltas to be discarded. Reasoning content is now flushed to the message list before clearing, and the late `reasoning-end` no longer adds a duplicate empty message.
