---
'@mastra/memory': patch
'@internal/playground': patch
---

Observational Memory extractor values now run in a non-blocking structured extraction pass after observations persist, so observation writes are no longer coupled to extractor generation or validation. Extraction successes and failures now emit standalone stream markers so Playground can render asynchronous extraction activity even when it is not tied to an observation cycle badge.
