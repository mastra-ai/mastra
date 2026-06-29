---
'@mastra/memory': minor
'@mastra/core': minor
---

add OM-managed working memory

Adds `observationalMemory.observation.manageWorkingMemory` so the Observer can update working memory automatically instead of requiring the main agent to call the working memory tool.

```ts
new Memory({
  options: {
    workingMemory: { enabled: true },
    observationalMemory: {
      enabled: true,
      observation: { manageWorkingMemory: true },
    },
  },
})
```

This option adds `WorkingMemoryExtractor`, defaults `workingMemory.agentManaged` to `false`, and defaults `workingMemory.useStateSignals` to `true` when working memory is enabled. Set `workingMemory.agentManaged: true` to keep the main agent's working memory tool and instructions enabled.
