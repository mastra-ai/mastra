---
'@mastra/core': patch
---

Skip `isTaskComplete` completion grading when the iteration errored. Grading an errored iteration could flip the continuation decision back on and re-issue the failing request until `maxSteps` was exhausted (#21897). The skip previously existed only on the durable engine; it now applies to the default in-process loop as well.
