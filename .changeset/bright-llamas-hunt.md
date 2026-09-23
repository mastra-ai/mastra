---
'@mastra/connect': minor
---

Added multi-connection support and a string-array shorthand to `@mastra/connect`.

**Multi-connection support:** when a provider has more than one active connection, tools are wrapped with a required `connection_name` input and a new `<provider>_list_connections` tool is exposed so agents can discover and select which connection to use. Single-connection behavior and explicit `connectionId` pins are unchanged.

Previously, multi-active provider connections were skipped with a warning.

```ts
const tools = await connect({ integrations: ['linear'] });

// Agent lists available connections
await tools.linear_list_connections.execute({ context: {} });
// => { connections: [{ name: 'Work' }, { name: 'Personal' }] }

// Agent calls tools with the chosen connection
await tools.linear_get_issue.execute({ context: { connection_name: 'Work', id: 'LIN-123' } });
```

**String-array shorthand for `integrations`:** you can now pass a plain array of integration ids when no per-provider overrides are needed. The object form still works whenever you need `allowTools`, `disallowTools`, `autoApproveTools`, `connectionId`, or `disabled`.

```ts
// Shorthand
connect({ integrations: ['linear', 'github'] });

// Object form (unchanged)
connect({
  integrations: {
    linear: { allowTools: ['linear_get_issue'] },
    github: {},
  },
});
```

**`disallowTools` per provider:** each provider now accepts either `allowTools` or `disallowTools` — `ConnectIntegrationOptions` is a mutually exclusive union, so setting both is a compile-time and runtime error. Use `disallowTools` when you want the whole toolset minus a few keys instead of an explicit allowlist.

```ts
connect({
  integrations: {
    // Everything except the delete tool
    linear: { disallowTools: ['linear_delete_issue'] },
    // Explicit allowlist still works
    github: { allowTools: ['github_get_repo'] },
  },
});
```
