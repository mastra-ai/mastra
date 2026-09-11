---
'@mastra/temporal': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

Fixed evented agent streams hanging forever when a run fails before its first chunk. A workflow-level failure now surfaces as an error on the stream instead of leaving the consumer waiting.
