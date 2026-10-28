---
'@mastra/braintrust': patch
---

Model spans keep `timeToFirstTokenMs` out of Braintrust metadata, as with `completionStartTime`; Braintrust already derives time to first token itself.
