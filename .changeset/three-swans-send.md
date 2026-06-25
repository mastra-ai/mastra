---
'@mastra/core': patch
---

Fixed tool-level `background` config being silently ignored. The `background` option passed to `createTool` was accepted by the type system but never stored on the tool instance, so tools opted into background execution at the tool level always ran in the foreground. The option is now stored on the tool and dispatched as a background task.

```typescript
const researchTool = createTool({
  id: 'research',
  description: 'Run a long research job',
  inputSchema: z.object({ topic: z.string() }),
  background: { enabled: true, timeoutMs: 600_000 },
  execute: async ({ topic }, context) => {
    // ...
  },
})
```
