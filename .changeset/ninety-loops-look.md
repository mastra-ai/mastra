---
'@mastra/core': minor
---

Added `delegation.hookErrorStrategy` so a failing delegation hook no longer passes silently.

Previously, if `onDelegationStart`, `messageFilter`, or `onDelegationComplete` threw, the error was only logged and the delegation carried on. A throwing `onDelegationStart` could not block a subagent, and a throwing `onDelegationComplete` lost whatever the hook was responsible for with no programmatic signal.

**Detecting hook failures**

Hook failures are now always recorded on the run's request context, whatever strategy you choose:

```ts
const requestContext = new RequestContext();
await parentAgent.generate('Research AI trends', { requestContext });
const hookErrors = requestContext.get('__mastra_delegationHookErrors') ?? [];
```

**Failing the delegation instead**

Opt in to fail-closed behavior. A throwing `onDelegationStart` then blocks the subagent, and a throwing `messageFilter` or `onDelegationComplete` surfaces to the parent as a failed tool call:

```ts
await parentAgent.generate('Research AI trends', {
  delegation: { hookErrorStrategy: 'throw', onDelegationComplete },
});
```

The default remains `'warn'`, so existing behavior is unchanged. Fixes #21624.
