---
'@mastra/core': patch
---

Fixed tool calls reported inconsistently in `onStepFinish` and `onFinish` steps.

- Durable and evented agents now report `toolCalls` in the same chunk shape as the normal agent, leave failed and declined calls out of `toolResults`, and keep tool results rewritten by output processors.
- On every engine, when a model makes several tool calls in one step, step `content` now holds every call and its result, in call order, instead of only the last call. Failed calls keep their existing shape: a `tool-result` whose `output` is `error-text` or `error-json`.
