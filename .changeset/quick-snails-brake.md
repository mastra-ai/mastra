---
'@mastra/core': patch
---

Reduced storage used by durable agent runs. The conversation transcript is now saved once per workflow snapshot instead of being copied into every step's input and output. In a 12-iteration tool-calling run this cut persisted snapshot size by about 31% on the default engine and 63% on the evented engine. Runs started on an earlier version still resume and finish normally. Runs started on this version can't be resumed after downgrading to an earlier `@mastra/core` version.
