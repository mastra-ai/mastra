---
'@mastra/connect': minor
---

Added multi-connection support and a string-array shorthand to `@mastra/connect`.

**Multi-connection support:** when a provider has more than one active connection, tools are wrapped with a required `connection_name` input and a new `<provider>__list_connections` tool is exposed so agents can discover and select which connection to use. Single-connection behavior and explicit `connectionId` pins are unchanged. The wrapper preserves each inner tool's approval contract (`requireApproval` and, when the MCP server-level policy is a function, `needsApprovalFn`) so approval prompts still fire for multi-connection MCP tools; missing or unknown `connection_name` fails closed and requires approval.

The helper key uses a double underscore (`<integrationId>__list_connections`) so it cannot collide with a real provider tool of the form `<integrationId>_<toolName>` (for example, WorkOS ships a real `workos_list_connections` tool that lists SSO connections).

Previously, multi-active provider connections were skipped with a warning.

```ts
// connect() returns a resolver; call it to load tools.
const tools = await connect({ integrations: ['linear'] })();

// Agent lists available connections.
await tools.linear__list_connections.execute({}, {});
// => { connections: [
//      { name: 'Work', accountLabel: 'Work' },
//      { name: 'Personal', accountLabel: 'Personal' },
//    ] }

// Agent calls tools with the chosen connection.
await tools.linear_get_issue.execute({ connection_name: 'Work', id: 'LIN-123' }, {});
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
