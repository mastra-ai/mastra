---
'@mastra/core': patch
---

Added `onDetection` callback to `PromptInjectionDetector` and `PIIDetector` processors, allowing custom handling (logging, alerting, metrics) when threats or sensitive data are detected without needing to subclass.
