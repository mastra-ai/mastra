---
'@mastra/core': minor
'@mastra/observability': minor
---

Auto-instrument workspaces when Mastra observability is configured.

When a `Workspace` is registered on a `Mastra` instance that has `observability` configured, its filesystem and sandbox providers are transparently wrapped so every method call emits a span, a duration metric, an error counter (on throw), and a structured log. Workspaces created standalone or attached to a `Mastra` without `observability` are unaffected — the raw provider is returned so there is zero overhead.

A new `WorkspaceActivityEvent` bus channel carries two variants:

- `sandbox_output` — stdout/stderr from `executeCommand` and `processes.spawn` (chunks over 16 KB are truncated and carry `truncated: true`; stdin is never emitted)
- `filesystem_change` — path + operation metadata for mutating filesystem calls (`writeFile`, `appendFile`, `deleteFile`, `copyFile`, `moveFile`, `mkdir`, `rmdir`). File contents are never included.

Exporters and bridges can opt in by implementing the new optional `onWorkspaceActivityEvent(event)` hook on `ObservabilityEvents`. Handlers that don't implement it silently drop the events.

```ts
import type { ObservabilityExporter, WorkspaceActivityEvent } from '@mastra/core/observability';

export const workspaceActivityExporter: ObservabilityExporter = {
  name: 'workspace-activity-logger',
  onWorkspaceActivityEvent(event: WorkspaceActivityEvent) {
    if (event.type === 'filesystem_change') {
      console.log('[fs]', event.change.operation, event.change.path);
    } else {
      // 'sandbox_output' — event.output.chunk carries stdout/stderr text
      console.log('[sb]', event.output.stream, event.output.chunk);
    }
  },
};
```

Agent-owned workspaces (`new Agent({ workspace })`) are wrapped automatically via `Agent.__registerMastra` fanout.
