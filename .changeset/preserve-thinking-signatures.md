---
'@mastra/core': patch
---

Fix API replay errors with reasoning models (such as Anthropic extended thinking) by preserving provider signatures and reasoning metadata during stream processing, and preventing empty assistant turns from being sent back to model providers on multi-turn conversations.
