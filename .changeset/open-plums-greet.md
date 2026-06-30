---
'@mastra/mongodb': patch
---

Made MongoDB store writes safe against partial failures, preventing orphaned records when an operation fails partway through.

**Atomic multi-collection writes.** Creates, deletes, and updates across the agents, mcp-clients, mcp-servers, prompt-blocks, scorer-definitions, skills, workspaces, schedules, and datasets domains now run in a transaction on replica sets, so a failed write leaves no half-written state. On standalone servers (which can't run transactions) these degrade to sequential best-effort, matching the previous behavior.

**Scalable cascade deletes.** Deleting a thread (with its messages) or a dataset (with its items) is deliberately *not* wrapped in a transaction, because those children are unbounded and a transactional delete is capped by MongoDB's 60-second transaction limit — a large thread or dataset would abort and become permanently undeletable. Instead the children are removed first and the parent record last, so a failure mid-delete leaves the parent in place and re-running the delete safely finishes the job.
