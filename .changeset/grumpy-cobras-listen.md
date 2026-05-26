---
'@mastra/core': patch
---

**Fixed browser propagation from controllers (CLI commands, harness wrappers) silently losing effect on the next agent run.**

Higher-level controllers that update an agent's browser were not stable across the workspace reconciliation that runs before each agent invocation: the new browser was either cleared by `getWorkspace()` when no workspace was configured, or overwritten by the workspace's own browser slot when set. After the update, the controller's browser sticks across subsequent runs, and dedicated controller calls can update the browser repeatedly without being mistaken for an explicit user configuration.

Agents constructed with their own browser, or updated via `Agent.setBrowser()`, continue to win against any controller update — the precedence rule is unchanged.

`Harness.setBrowser()` and the harness's per-agent service propagation now route through the same controller-managed path, so harness-level browser updates inherit the same stability and stop double-applying when a single agent is registered across multiple modes.
