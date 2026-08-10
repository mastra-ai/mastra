---
'@mastra/core': patch
---

Fixed experiment runs reporting a failed outcome instead of cancelled when cancellation interrupted an in-flight item. Cancelled experiment runs now consistently finish with a cancelled outcome, so standalone experiment workers exit with the cancellation exit code instead of a failure code.
