## 6. Tool authoring contract

Tools authored for the Harness are standard Mastra agent tools — same
`description`, `inputSchema`, `outputSchema`, and `execute(input, context)`
shape. The Harness extends them by populating a `'harness'` slot on the agent's
`RequestContext`, reachable from `execute` via:

```ts
const harnessCtx = context.requestContext.get('harness') as HarnessRequestContext;
```

This section is the contract for that slot. The top-level `'harness'` key is a
Harness-owned runtime slot, not caller metadata. It is rebuilt for each tool
execution and is never read from caller-supplied `requestContext` or persisted
request-context rows. Harness v1 attaches it to a detached per-execution
`RequestContext` or overlay; it must not mutate a caller-owned `RequestContext`
object in place.

Harness-managed tool execution uses a Harness-specific projection of the normal
Mastra tool context. It preserves `execute(input, context)` and the detached
per-execution `context.requestContext.get('harness')` slot, but it must not
expose the generic `MastraUnion` authority as `context.mastra`. A v1
implementation may omit `context.mastra` entirely. If it exposes a compatibility
facade, that facade must be an explicit allowlist and must not expose raw
storage, deprecated primitive storage, agent or workflow registries, provider or
channel clients, mutable framework registries, or other session-bypassing
framework capabilities. Non-Harness Mastra tool execution may keep its current
compatibility behavior unless a separate generic Mastra API migration changes
that surface.
