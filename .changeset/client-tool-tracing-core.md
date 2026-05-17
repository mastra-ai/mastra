---
'@mastra/core': minor
---

Client-side tools now appear in your traces when observability is configured. When an agent calls a tool that executes in the browser via `@mastra/client-js`, a `CLIENT_TOOL_CALL` span is recorded on the server trace so you can see which client tools were invoked and how they relate to the rest of the agent run.

Tools also gain an `observe` helper on their execution context for recording child spans and logs from inside `execute`:

```ts
execute: async ({ userId }, { observe }) => {
  observe.log('info', 'fetching user', { userId })
  return observe.span('fetch user', () => fetch(`/api/users/${userId}`))
}
```
