## 6. Tool authoring contract

Tools authored for the Harness are standard Mastra agent tools — same `description`, `inputSchema`, `outputSchema`, and `execute(input, context)` shape. The Harness extends them by populating a `'harness'` slot on the agent's `RequestContext`, reachable from `execute` via:

```ts
const harnessCtx = context.requestContext.get('harness') as HarnessRequestContext;
```

This section is the contract for that slot.
