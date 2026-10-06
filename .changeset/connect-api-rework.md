---
'@mastra/connect': minor
---

Reworked the `@mastra/connect` API ahead of the first stable release. Breaking: the package has not shipped stable, so no deprecation period applies.

**Renamed `integrations` to `providers`**

The option on `tools()` and `channels()` is now called `providers`, with types renamed to match (`ToolsProviderOptions`, `ChannelsProviders`, `ChannelsProviderOptions`).

```ts
// Before
const connectTools = tools({ integrations: { linear: { allowTools: ['linear_get_issue'] } } });

// After
const connectTools = tools({ providers: { linear: { allowTools: ['linear_get_issue'] } } });
```

**Merge your own tools with `.with()`**

The resolver can now combine connect tools with an agent's local tools in one expression. It accepts a static tool record or a function (sync or async, optionally reading the request context); your tools win on key collision, and calls chain.

```ts
const agent = new Agent({
  // ...
  tools: connectTools.with({ weatherTool }),
});
```

**Simpler provider selection**

The array form is now a real allowlist (only the listed providers resolve), and the record form accepts boolean shorthand:

```ts
tools({ providers: ['linear', 'resend'] }); // only these resolve
tools({ providers: { linear: true, github: false } }); // enable / exclude
```

Unknown provider ids now fail with `invalid_options` instead of warning once and silently resolving nothing.

**Glob filters and top-level defaults**

`allowTools`, `disallowTools`, and `requireApproval` accept `*` globs, and all three can be set at the top level of `tools()` as defaults for every provider. Per-provider options win, including `requireApproval: false` to opt out of a global policy.

```ts
tools({
  requireApproval: ['*_delete_*', '*_send_*'],
  providers: { linear: { requireApproval: false } },
});
```

A per-provider glob that matches nothing fails like an unknown literal name, so typos never silently widen access.

**Removed**

- The deprecated `connect()` alias of `tools()`.
- The `environment()` sandbox credential surface.
- The `MASTRA_<PROVIDER>_CONNECTION_ID` env-var pin is no longer documented (it keeps working); pass `connectionId` per provider instead.
- The `TOOLS` registry alias (use `PROVIDERS`) and the `findRegistration`/`findChannelRegistration` lookup helpers.
- Internal toolset plumbing (`defineProxyTool`, `applyAllowTools`, `resolveConnectionId` and their types) is no longer exported.
- The `disabled: true` per-provider field — use the `false` shorthand instead: `providers: { github: false }`.
- The resolver `invalidate()` method — call `refresh()` to force a fetch now, or lower `ttlMs` to control freshness.
