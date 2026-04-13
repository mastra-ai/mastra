---
'@mastra/client-js': minor
---

Client-side tool tracing is now built in. The SDK automatically measures execution duration and ships it back to the server — no configuration needed. To add child spans and structured logs from inside your tool's `execute` function, use the `observe` helper on the execution context:

```ts
execute: async ({ userId }, { observe }) => {
  observe.log('info', 'fetching user', { userId })
  return observe.span('fetch user', () => fetch(`/api/users/${userId}`))
}
```
