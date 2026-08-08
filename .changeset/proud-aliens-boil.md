---
'@mastra/server': patch
---

Workspace HTTP handlers now use the new async `Mastra.resolveWorkspaceById` when available, so dynamic per-session workspaces can be re-materialized on demand after a container restart or on a fresh replica. Prevents spurious 404s (`MASTRA_GET_WORKSPACE_BY_ID_NOT_FOUND`) for workspaces whose durable state lives outside the process. When the resolver is present, the legacy agent-iteration fallback is intentionally skipped — the resolver + registry are authoritative — so unresolvable ids no longer invoke every agent's function-based workspace with a default `RequestContext`. Behavior on older `@mastra/core` (no async resolver) is unchanged.
