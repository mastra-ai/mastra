---
'@mastra/core': minor
---

Fixed workflow stream events losing data across engines:

- Custom events sent with `writer.custom()` no longer lose their `data` on the evented engine.
- When a run is resumed or time-travelled, custom events now carry the run id and `from`, like the events of a started run.
- The `workflow-finish` event of a failed run now carries the run's `error`. On the evented engine it reported `success` for a failed run; it now reports `failed`.

`WorkflowStreamEvent` now includes custom `data-*` events, and the `workflow-finish` and `workflow-step-result` payloads are typed by status: a failed one has `error`, a tripwire finish has `tripwire`. TypeScript asks you to check `type` before reading `payload`:

```ts
for await (const event of run.stream({ inputData }).fullStream) {
  if (event.type === 'workflow-finish' && event.payload.workflowStatus === 'failed') {
    console.error(event.payload.error);
  }
  if (event.type === 'data-progress') {
    console.log(event.data);
  }
}
```
