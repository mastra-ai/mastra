---
'@mastra/pg': patch
---

Added support for recovering evented agent runs when a worker process stops. Another worker can finish the run without overwriting completed steps or repeating completed loop iterations.

Requires `@mastra/core` version `1.79.1` or later for worker recovery support. Upgrade `@mastra/pg` together with `@mastra/core`. Let runs started on older versions finish before upgrading.
