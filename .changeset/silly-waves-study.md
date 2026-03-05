---
'@mastra/core': patch
---

Fixed LLM errors (generateText, generateObject, streamText, streamObject) being swallowed by the AI SDK's default handler instead of being routed through the Mastra logger. Errors now appear with structured context (runId, modelId, provider, etc.) in your logger, and streaming errors are captured via onError callbacks.
