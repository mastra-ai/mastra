---
'@mastra/pg': patch
---

Added support for recovering evented agent runs when a worker process stops. Another worker can finish the run without overwriting completed steps or repeating completed loop iterations.

Upgrade `@mastra/pg` together with `@mastra/core`. Let runs started on older versions finish before upgrading.
