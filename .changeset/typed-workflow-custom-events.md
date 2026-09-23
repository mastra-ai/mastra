---
'@mastra/core': minor
---

Fixed custom events sent with `writer.custom()` in workflow streams:

- On the evented engine, they no longer lose their `data`.
- When a run is resumed or time-travelled, they now carry the run id and `from`, like the events of a started run.

`WorkflowStreamEvent` now includes these custom `data-*` events, so TypeScript asks you to check `type` before reading `payload`:

```ts
for await (const event of run.stream({ inputData }).fullStream) {
  if (event.type === 'workflow-step-result') {
    console.log(event.payload.id);
  }
  if (event.type === 'data-progress') {
    console.log(event.data);
  }
}
```
