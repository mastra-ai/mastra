---
'@mastra/client-js': minor
---

Client-side tool tracing is now built in. When server-side observability is configured, the SDK automatically measures execution duration and ships it back to the server. To add child spans and structured logs from inside your tool's `execute(input, context)` function, use the `observe` helper on the execution context:

```ts
execute: async ({ userId }, { observe }) => {
  observe.log('info', 'fetching user', { userId })
  return observe.span('fetch user', () => fetch(`/api/users/${userId}`))
}
```

The `createTool()` helper now calls `execute(input, context)` so client tools receive the same execution context shape as core tools.
