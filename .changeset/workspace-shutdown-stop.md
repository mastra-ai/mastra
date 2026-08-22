---
'@mastra/core': minor
---

`Mastra.shutdown()` no longer destroys registered workspaces' sandboxes. Remote sandboxes (E2B, Platform, and other providers) were being killed on every process restart; they are now stopped instead, so providers that support suspension pause the sandbox and resume it later with filesystem and memory intact.

- New `Workspace.stop()`: shuts down language servers, closes the browser, and stops the sandbox without destroying anything. The workspace stays usable and the sandbox can start again later.
- `LocalSandbox.stop()` now kills background processes (previously only `destroy()` did), so the stop-on-shutdown behavior cannot leak child processes on local sandboxes. Files in the working directory are untouched.
- Full teardown remains explicit: `workspace.destroy()` or `mastra.removeWorkspace(id, { destroy: true })`.

```typescript
// Suspend live resources; the workspace stays usable
await workspace.stop();

// Full teardown is explicit
await workspace.destroy();
```
