---
'@mastra/core': patch
---

Added experimental Tool Gate enforcement for non-durable agent runs. Tool Gate policies can now filter model-visible tools and require approval or reject server-side tool calls at runtime.

```ts
await agent.stream('Review this PR', {
  toolGatePolicy: {
    id: 'workspace-policy',
    evaluate: ({ subject }) =>
      subject.boundary === 'tool-call'
        ? { effect: 'requireApproval', reason: 'External actions need approval' }
        : { effect: 'allow', reason: 'Allowed' },
  },
});
```
