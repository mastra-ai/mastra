---
'@mastra/core': minor
---

Added `onDetection` callback to `PromptInjectionDetector` and `PIIDetector` processors, allowing custom handling (logging, alerting, metrics) when threats or sensitive data are detected without needing to subclass.

**Usage**

```ts
const detector = new PIIDetector({
  model: 'openai/gpt-4o',
  onDetection: ({ detectionResult, input, strategyApplied }) => {
    console.log('PII detection:', { detectionResult, strategyApplied });
  },
});
```
