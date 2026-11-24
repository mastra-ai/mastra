---
'@mastra/datadog': minor
---

Added feedback export to `DatadogExporter` and `DatadogBridge`. Feedback recorded with `addFeedback()` now shows up in Datadog LLM Observability on the trace or span it rates, even when it arrives hours after the run. Datadog traces now use the Mastra trace ID, so you can also search Datadog for the `traceId` a run returns. `DatadogExporter` also sends scores that arrive after the run ends or from another process. Before, it dropped them. A run inside an existing LLM Observability trace, such as your own `llmobs.trace()` call or one continued from an upstream service, keeps the existing trace ID. Only feedback with a `spanId` and scores sent during the run reach it.

```ts
await mastra.observability.addFeedback?.({
  traceId,
  feedback: { feedbackType: 'thumbs', value: 'down', comment: 'Wrong answer' },
});
```
