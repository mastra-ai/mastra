---
'@mastra/factory': minor
---

**BREAKING: `sandbox` is now a callback that constructs the session's sandbox**

```ts
// Before — no longer accepted
sandbox: { machine: new RailwaySandbox({ apiToken }), workdir: '/workspace', maxSandboxes: 4 }

// After
sandbox: ctx => new E2BSandbox({ id: ctx.sessionId })
```

A factory still configured with the old options object fails at `prepare()` with a message showing the replacement: `machine` becomes the provider instance you construct inside the callback, `workdir` is gone (remote providers clone into the VM's home directory, local providers use their own `workingDirectory`), and `maxSandboxes` is gone with the fleet. Omit `sandbox` entirely to run without sandboxes. `ctx.getRepositoryAccess` resolves the session repository's clone URL plus a fresh short-lived credential (`undefined` when the session has no repository), so providers can authenticate work such as private-repo template builds.

Session sandboxes now boot lazily at the first real command instead of being provisioned up front. The sandbox fleet (pooling, budgets, reattach/revival, base checkpoints) is deleted, and the `/ensure` endpoint and the session UI's "preparing sandbox" step go with it — opening a thread provisions nothing. To check whether a sandbox is configured, read `sandboxEnabled` from `GET /web/github/status`.

A failing setup command no longer wedges the session. The first failure surfaces loudly in the tool result that triggered it, then later starts skip the known-bad command — the clone and branch checkout still run, so the agent can repair or rerun setup itself. Infrastructure failures (clone, checkout, transport) keep failing hard and retry in full.

Existing databases keep the fleet-era tables and columns as untouched orphans; dropping them is a manual operation.
