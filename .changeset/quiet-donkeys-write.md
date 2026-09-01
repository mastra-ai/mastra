---
'@mastra/playground': patch
---

Restore the missing delete action on the standalone agent thread sidebar (`/agents/<agentId>/threads/<threadId>`), lost in the #22675 redesign. Each thread row now offers a guarded delete control (confirmation dialog, `memory:delete` permission check) wired to the existing memory-thread delete endpoint, and deleting the active thread navigates back to a new thread.
