---
'@mastra/code-sdk': patch
---

Fixed woken notifications running against the controller-level workspace, which is `undefined` for dynamic workspace factories. They now use the workspace of the session that owns the target thread.
