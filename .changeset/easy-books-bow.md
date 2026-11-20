---
'@mastra/core': patch
---

Fixed `DurableAgent` and `EventedAgent` answering two messages on the same thread at the same time. A second `stream()` or `generate()` call on a busy thread now waits for the run in progress, as it already did for a regular agent, so replies are saved in the order of the conversation. See [#30069](https://github.com/mastra-ai/mastra/issues/30069).
