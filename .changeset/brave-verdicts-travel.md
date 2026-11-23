---
'@mastra/datadog': minor
---

Added support for a pass or fail assessment on feedback sent to Datadog. Set `metadata.datadog.assessment` to `pass` or `fail`, and you can search feedback by assessment in Datadog, whatever its value. Feedback without it is sent as before.

```ts
await mastra.observability.addFeedback?.({
  traceId,
  feedback: {
    feedbackType: 'thumbs',
    value: 'down',
    metadata: { datadog: { assessment: 'fail' } },
  },
});
```
