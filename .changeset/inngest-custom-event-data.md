---
'@mastra/inngest': patch
---

Fixed Inngest workflow streams:

- Custom events sent with `writer.custom()` no longer lose their `data`.
- The finish event of a failed run now uses the same `workflowStatus` and `error` keys as the other engines, instead of `status`, so consumers reading `workflowStatus` no longer see it undefined.
