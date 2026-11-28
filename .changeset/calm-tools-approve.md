---
'@mastra/core': minor
---

Added a configurable default tool-approval policy for AgentController sessions. Set `defaultToolApprovalPolicy` to choose whether tools without a more specific Session policy are allowed, denied, or sent for approval.

```typescript
const controller = new AgentController({
  id: 'assistant-controller',
  agent,
  defaultToolApprovalPolicy: 'allow',
  modes,
})
```

Explicit tool and category policies still take precedence. The default remains `ask`.
