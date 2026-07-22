---
'@mastra/core': patch
---

Fixed durable Agent prompt build clobbering a valid tool-result `output` with `undefined`. `MessageList`'s `llmPrompt()` restores stored tool outputs by keying off `'modelOutput' in providerMetadata.mastra` (key presence) and then unconditionally overwriting the already-converted `output`. When a tool's `toModelOutput` returns `undefined` (e.g. a text-only result), the durable llm-mapping step still persists `mastra: { modelOutput: undefined }`, so the override replaced the correct output with `undefined` — producing a tool-result whose `output` is missing. Providers that read `output.type` (e.g. `@openrouter/ai-sdk-provider`) then threw `Cannot read properties of undefined (reading 'type')`, aborting the request and poisoning the thread on every subsequent turn. The override now only applies when the stored `modelOutput` is non-nullish.
