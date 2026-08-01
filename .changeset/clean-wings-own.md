---
'@mastra/react': patch
---

Fixed streamed assistant messages in `useChat`-style threads being keyed by a stale message id when observational memory rotates the response message id during a run. The accumulator now follows the rotated id carried by `step-start`, so streamed messages always match the ids they are persisted under and no longer disappear or duplicate after a refresh. Part of the fix for [#19810](https://github.com/mastra-ai/mastra/issues/19810)
