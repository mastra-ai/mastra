---
'@mastra/core': patch
---

Added a typed `model` override to `approveToolCall`, `declineToolCall`, `approveToolCallGenerate`, and `declineToolCallGenerate`. The resume path already honored `model` (via `resumeStream`/`resumeGenerate`), but the public approve/decline signatures omitted it, so agents whose model is resolved per run had no typed way to pick the model for the resumed segment without casting past the signature.

```ts
// Now type-checks — previously required casting past the public type
await agent.approveToolCall({ runId, model: myRunModel });
```
