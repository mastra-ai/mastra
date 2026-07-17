---
'@mastra/ai-sdk': patch
---

Fix durable agent streaming: guard the `step-start` branch of `convertMastraChunkToAISDKBase` against a missing `payload`.

`@mastra/core` >= 1.49 emits a durable `step-start` chunk with `payload: undefined`. The `step-start` case destructured `chunk.payload` directly (unlike the neighbouring `start` case, which guards with `chunk.payload?.messageId`), so `toAISdkStream` threw `Cannot destructure property 'messageId' of 'chunk.payload' as it is undefined` immediately after the `start` frame — a client received only `start` and the stream tore down. Guard with `chunk.payload ?? {}`.
