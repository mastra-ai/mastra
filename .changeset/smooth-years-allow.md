---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
'mastracode': patch
---

Fixed agent controller session snapshots to include the current task list so Mastra Code restores task progress after refreshes, thread changes, and connection recovery.

Exports the canonical `taskItemSchema` from `@mastra/core/agent-controller` so server routes and other consumers can validate task snapshots against the single source of truth.
