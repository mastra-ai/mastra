---
'@mastra/core': patch
---

Fixed model fallback logging so recovered failures no longer page as errors. When a model in a `models` chain fails and another model is still available, Mastra now logs a single warning naming the failed and next model instead of two error-level records. Failures of the last model in the chain are still reported as errors.
