---
'@mastra/core': patch
---

Fixed evented parallel and conditional workflows losing setState() updates from sibling branches; state changes from every branch are now merged into the workflow state (fixes #22319)
