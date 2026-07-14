---
'@mastra/core': patch
---

Fixed `DurableAgent` losing reasoning items on turns that include tool calls, which caused OpenAI reasoning models like `gpt-5-mini` to fail on the next turn. Reasoning is now preserved and replayed correctly on subsequent turns.

Fixes #19365.
