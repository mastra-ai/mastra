---
'@mastra/core': minor
---

Added `parentToolCalls` to delegation hook contexts (`onDelegationStart`, `onDelegationComplete`, `messageFilter`). Supervisor agents now expose the parent agent's tool call history — including tool names, arguments, and results — to all delegation hooks, enabling smarter routing and context-aware delegation decisions.

```ts
await supervisor.generate('Search and analyze', {
  delegation: {
    onDelegationStart: (ctx) => {
      const searched = ctx.parentToolCalls.some(tc => tc.name === 'search-db');
      if (searched) {
        return { proceed: true, modifiedPrompt: `Use these results: ${JSON.stringify(ctx.parentToolCalls.find(tc => tc.name === 'search-db')?.result)}` };
      }
      return { proceed: false, rejectionReason: 'No search performed yet' };
    },
    onDelegationComplete: (ctx) => {
      console.log('Parent tools used:', ctx.parentToolCalls.map(tc => tc.name));
    },
    messageFilter: (ctx) => {
      if (ctx.parentToolCalls.some(tc => tc.isError)) {
        return ctx.messages.slice(-3);
      }
      return ctx.messages;
    },
  },
});
```
