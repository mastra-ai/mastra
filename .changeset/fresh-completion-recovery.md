---
'@mastra/core': patch
---

Restore default task-completion scorers when a durable agent run recovers after a process restart. Warn when scorers cannot be restored; per-call scorer instances are not persisted and cannot be recovered.
