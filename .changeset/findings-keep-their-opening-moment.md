---
'@mastra/factory': patch
---

Supervisor findings no longer churn the attention inbox. A finding now carries the instant its condition began instead of a live age, so a health tick that finds nothing new writes nothing, and the inbox orders findings by when they opened rather than by the last tick.
