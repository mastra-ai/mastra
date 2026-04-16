---
'@mastra/core': patch
---

Fixed assistant model attribution so provider and model information is preserved more reliably in stored assistant messages.

Loop runs now keep the resolved model on the first `step-start`, already-attributed `step-start` parts are left alone, and post-tool assistant continuations preserve their incoming metadata when they merge into an existing assistant message.

This keeps downstream features working with the correct model identity instead of falling back to incomplete metadata or losing it during merge.
