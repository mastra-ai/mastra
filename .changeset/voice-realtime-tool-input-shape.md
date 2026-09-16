---
'@mastra/voice-openai-realtime': patch
---

Fix `createTool` tools registered on `OpenAIRealtimeVoice` receiving the wrong input shape. Tools with an `inputSchema` were invoked as `execute({ context: args }, ...)`, so their `execute` received `{ context: { ...args } }` instead of the arguments directly — every field read as `undefined`, and tools with a Zod `inputSchema` failed validation. The adapter now passes arguments as the first positional argument, matching `@mastra/core`'s `ToolExecuteFunction(inputData, context)` signature.
