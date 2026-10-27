---
'@mastra/core': patch
---

Fixed tool calls reported inconsistently in `onStepFinish` and `onFinish` steps.

- Durable and evented agents now report `toolCalls` in the same chunk shape as the normal agent, leave failed and declined calls out of `toolResults`, and keep tool results rewritten by output processors. After an approval resume, they no longer restore results the stream never emitted, such as results hidden by an output processor or pending client tool calls. Results an output processor holds until the end of the stream are still reported.
- `Agent` now keeps a suspended run's per-call `outputProcessors` and applies them when `approveToolCall`, `declineToolCall` or `resumeStream` is called in the same process without its own. Before, the resumed run skipped them, so it could emit content they would have hidden or rewritten.
- On every engine, when a model makes several tool calls in one step, step `content` now holds every call and its result, in call order, instead of only the last call. Failed calls keep their existing shape: a `tool-result` whose `output` is `error-text` or `error-json`.
