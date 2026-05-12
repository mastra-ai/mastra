### 12.8 Subagents and depth

```ts
const harness = new Harness({
  ...config,
  sessions: {
    maxSubagentDepth: 2, // parent → child → grandchild allowed; great-grandchild blocked
  },
});

session.subscribe((event) => {
  if (event.type === 'subagent_start') {
    console.log(
      `[depth=${event.depth}] subagent ${event.agentType} started`,
      event.parentId ? `(parent=${event.parentId})` : '(root)',
    );
  }
});
```
