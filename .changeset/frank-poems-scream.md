---
'@mastra/core': patch
---

Fixed generate() and resumeGenerate() silently swallowing errors when the model stream's error and finishReason signals are out of sync. Previously, errors were only thrown when finishReason was 'error', but some providers (e.g., Google Gemini) can emit error chunks while reporting a different finishReason like 'stop'. Now errors are always surfaced to the caller regardless of finishReason.
