---
'@mastra/core': patch
---

Fixed `run.timeTravel()` dropping resume data that is `false`, `0`, an empty string, or `null`. These values now reach the suspended step when they match its `resumeSchema`, the same way they do with `run.resume()`. Fixes #29390.

Known limitation: on the evented engine, `run.timeTravel()` still does not pass resume data to a step inside a nested workflow, whatever its value. Flat evented workflows and the default engine are fixed.
