---
'@mastra/connect': major
---

**Breaking:** Discovered MCP tools no longer require approval by default, matching `@mastra/mcp`'s own default. Opt into approval per integration with the new `requireApproval` option.

Previously, every MCP tool discovered through `connect()` was forced to require approval, with an `autoApproveTools` escape hatch to list specific keys that should skip it. The forced-approval policy made the typical case needlessly interactive and diverged from `@mastra/mcp`, whose default is "no approval unless the server definition opts in."

The new `requireApproval` option replaces `autoApproveTools` and applies to generated HTTP toolsets as well as discovered MCP tools:

- Omit (or pass `false`) → no approval required for any tool on this provider
- `true` → every tool on this provider requires approval
- `string[]` → approval required only for the listed tool keys

Unknown names in the array fail resolution with an `invalid_options` error instead of silently dropping the provider, so a typo can neither widen access nor remove the toolset. A config that still contains the removed `autoApproveTools` key throws at `tools()` call time with a migration hint, so loosely typed configs cannot carry the dead option forward and run previously-gated tools without a prompt.

If you relied on the old always-on default (for example, agents scaffolded from the connect templates), opt back in explicitly with `requireApproval: true` on the providers whose tools should prompt before running.

**Migration**

```ts
// Before: approval required by default, allowlist of tools that skip it
connect({
  integrations: {
    neon: { autoApproveTools: ['neon_list_projects', 'neon_describe_project'] },
  },
});

// After (conservative): gate every tool on the provider. This preserves the
// former approval policy, except the tools previously listed in
// autoApproveTools now prompt too.
connect({ integrations: { neon: { requireApproval: true } } });

// After (targeted): gate only the listed tools. Not equivalent to the old
// default; every tool missing from the list runs without a prompt, so list
// every tool that must stay gated.
connect({
  integrations: {
    neon: { requireApproval: ['neon_delete_project'] },
  },
});
```
