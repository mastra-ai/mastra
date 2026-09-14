---
'@mastra/core': patch
---

Added persisted error parts for failed agent turns so thread history retains terminal failures.

```typescript
const memory = await agent.getMemory()
const { messages } = await memory!.recall({ threadId: 'thread-123', perPage: false })

for (const message of messages) {
  for (const part of message.content.parts ?? []) {
    if (part.type === 'error') {
      console.error(part.error.name, part.error.message)
    }
  }
}
```
