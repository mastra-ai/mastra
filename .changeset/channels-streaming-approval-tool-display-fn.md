---
'@mastra/core': patch
---

Fixed approval event delivery for function-form `toolDisplay` in streaming channels. A function-form `toolDisplay` now receives `approval` events when `streaming: true`, matching static mode. Return `{ kind: 'post', message }` to replace the built-in approval card; `undefined`, blank, or `stream` results fall back to the built-in card so the approval stays actionable.
