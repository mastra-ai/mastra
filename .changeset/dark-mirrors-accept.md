---
'@mastra/playground-ui': patch
'@mastra/react': patch
'@mastra/core': patch
'mastra': patch
'create-mastra': patch
---

Auto resume suspended tools if `autoResumeSuspendedTools: true`

The flag can be added to `defaultAgentOptions` when creating the agent or to options in `agent.stream` or `agent.generate`

```typescript
const agent = new Agent({
  //...agent information,
  defaultAgentOptions: {
    autoResumeSuspendedTools: true,
  }
})
```
