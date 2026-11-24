---
'@mastra/memory': patch
---

Fixed Observational Memory formatting the full recent conversation for every observation even when no `onExtracted` hook uses it. The history is now rendered only when a hook is about to receive it.
