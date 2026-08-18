---
'@mastra/core': patch
---

Fixed `ToolCallFilter` destroying stored tool calls. The filter used to rewrite the shared message list, so its filtered history was written back to memory and the original tool calls and results were permanently replaced with text. It now filters only the prompt sent to the model, leaving stored messages, memory, and UI history untouched. ([#21631](https://github.com/mastra-ai/mastra/issues/21631))

**Behavior change:** tool calls made during the current agent loop are no longer filtered by default, so the agent can still act on results it just produced. Use `filterAfterToolSteps` to filter during the loop:

```typescript
// Keeps only the two most recent tool-producing steps
new ToolCallFilter({ filterAfterToolSteps: 2 });
```
