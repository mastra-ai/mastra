---
'@mastra/core': patch
---

Fixed concurrent agent.stream() calls on the same thread racing instead of serializing. A second stream() call on the same agent, thread, and resource now waits for the active run to finish before recalling memory, so each turn sees the previous turn's messages and message history is persisted in turn-complete order. Read-only runs and resumed/suspended runs are not affected. Fixes https://github.com/mastra-ai/mastra/issues/21906
