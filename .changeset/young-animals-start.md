---
'@mastra/core': minor
---

Added an `onDetection` callback to `PIIDetector` and `PromptInjectionDetector` so you can observe detection results and build your own metrics.

The callback receives the raw detection result, the analyzed input, whether it crossed the threshold, and which strategy was applied.

```ts
new PIIDetector({
  model: 'openai/gpt-4o-mini',
  onDetection: ({ detectionResult, input, flagged, strategyApplied }) => {
    metrics.increment('pii.detections', { flagged, strategyApplied });
  },
});
```

Errors thrown from the callback are logged and never interrupt processing. Closes #13336
