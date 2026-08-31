---
'@mastra/core': minor
---

Added `modifiedSubAgentThreadId` on `onDelegationStart` so a supervisor can reuse a subagent's thread and load prior conversation history. Delegations still mint a fresh thread and disable `lastMessages` unless you opt in.

```ts
let specialistThreadId: string | undefined

await supervisor.generate(prompt, {
  memory: { thread: 'user-thread', resource: 'user-1' },
  delegation: {
    onDelegationStart: async () => {
      if (specialistThreadId) {
        return { modifiedSubAgentThreadId: specialistThreadId }
      }
    },
    onDelegationComplete: async ({ result }) => {
      specialistThreadId = result?.subAgentThreadId
    },
  },
})
```
