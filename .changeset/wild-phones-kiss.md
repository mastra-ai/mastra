---
'@mastra/playground-ui': minor
---

Added a Trace duration (ms) filter to Studio trace search.

Use the numeric comparison operators to filter completed traces by their root span duration.

```text
/traces?filterDurationMs=5000&filterDurationMs.op=gt
```
