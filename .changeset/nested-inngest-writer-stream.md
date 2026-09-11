---
'@mastra/inngest': patch
---

Forward chunks written inside nested Inngest workflows to the outermost parent run's stream, while preserving child-local streaming and existing lifecycle events.
