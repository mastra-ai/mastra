---
'@mastra/core': minor
---

Added `toModelOutput` support to the agent loop. Tool definitions can now include a `toModelOutput` function that transforms the raw tool result before it's sent to the model, while preserving the raw result in storage. This matches the AI SDK `toModelOutput` convention — the function receives the raw output directly and returns `{ type: 'text', value: string }` or `{ type: 'content', value: ContentPart[] }`.
