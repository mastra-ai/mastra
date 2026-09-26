---
'@mastra/core': patch
'@mastra/memory': patch
---

Prevented duplicate signed thinking when a sealed assistant message is reloaded with a resolved tool call. The result now updates the existing call without changing its arguments, provider call identity, or reasoning. Observational memory saves the resolved call so it survives the next turn.

Newly streamed text, reasoning, and processor data remain intact even when their content repeats earlier output. New content split from a sealed snapshot is saved separately instead of inheriting the old message's seal.

This prevents new duplicates that can cause Anthropic to reject a thread with "'thinking' or 'redacted_thinking' blocks in the latest assistant message cannot be modified". It does not repair threads that already contain duplicated messages. Fixes #22802.
