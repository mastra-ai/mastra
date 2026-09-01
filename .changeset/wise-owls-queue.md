---
'@mastra/core': patch
---

Serialize dynamic workflow registrations with overlapping workflow ids so a rejected registration cannot roll back a workflow that another registration successfully replaced. Unrelated ids no longer wait behind network storage I/O. Callers may cancel or bound queue admission; a rejected waiter never starts a storage mutation.
