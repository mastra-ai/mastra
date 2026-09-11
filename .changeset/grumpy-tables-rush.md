---
'@mastra/core': patch
---

Fixed a `400 Duplicate item found` error from OpenAI when continuing a conversation with `providerOptions.openai.previousResponseId`. Mastra no longer replays stored thread history into the prompt for that call, because the provider restores the earlier conversation server-side and the replayed messages referenced items it already held. Messages are still saved to memory as usual, so later calls without a provider-side chain recall normally. The same applies when the option is set under the `azure` or `xai` provider keys. Fixes #21908.
