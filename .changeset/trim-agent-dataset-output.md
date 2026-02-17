---
'@mastra/core': patch
---

Trimmed the agent experiment result `output` to only persist relevant fields instead of the entire `FullOutput` blob. The stored output now contains: `text`, `object`, `toolCalls`, `toolResults`, `sources`, `files`, `usage`, `reasoningText`, `traceId`, and `error`.

Dropped fields like `steps`, `response`, `messages`, `rememberedMessages`, `request`, `providerMetadata`, `warnings`, `scoringData`, `suspendPayload`, and other provider/debugging internals that were duplicated elsewhere or not useful for experiment evaluation.
