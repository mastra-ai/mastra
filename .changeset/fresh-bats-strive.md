---
'@mastra/memory': patch
'@mastra/core': patch
---

Extended readOnly memory option to also apply to working memory. When readOnly: true, working memory data is provided as context but the updateWorkingMemory tool is not available.

**Example:**

```typescript
// Working memory is loaded but agent cannot update it
const response = await agent.generate("What do you know about me?", {
  memory: {
    thread: "conversation-123",
    resource: "user-alice-456",
    options: { readOnly: true },
  },
});
```
