---
'@mastra/core': patch
---

Honor `maxProcessorRetries` for strict structured-output failures when a separate structuring model is configured. Failed structuring passes now request retries through the output-step processor lifecycle, rerunning the primary step and structuring model within the configured budget while preserving warn and fallback behavior.
