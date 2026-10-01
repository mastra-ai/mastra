---
'@mastra/connect': major
---

**Breaking:** Discovered MCP tools no longer require approval by default, matching `@mastra/mcp`'s own default. Opt into approval per integration with the new `requireApproval` option.

Previously, every MCP tool discovered through `connect()` was forced to require approval, with an `autoApproveTools` escape hatch to list specific keys that should skip it. The forced-approval policy made the typical case needlessly interactive and diverged from `@mastra/mcp`, whose default is "no approval unless the server definition opts in."

The new `requireApproval` option replaces `autoApproveTools`:

- Omit (or pass `false`) → no approval required for any tool on this provider
- `true` → every discovered tool requires approval
- `string[]` → approval required only for the listed tool keys

Unknown names in the array still throw at build time so a typo cannot silently widen access.

**Migration**

```ts
// Before: approval required by default, allowlist of tools that skip it
connect({
  integrations: {
    neon: { autoApproveTools: ['neon_list_projects', 'neon_describe_project'] },
  },
});

// After: no approval by default; opt into approval for the destructive subset
connect({
  integrations: {
    neon: { requireApproval: ['neon_delete_project'] },
  },
});

// Or require approval for every tool on this provider
connect({ integrations: { neon: { requireApproval: true } } });
```
