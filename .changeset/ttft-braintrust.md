---
'@mastra/braintrust': patch
---

Spans keep `timeToFirstTokenMs` out of Braintrust metadata, as with `completionStartTime`; Braintrust already derives time to first token itself.
