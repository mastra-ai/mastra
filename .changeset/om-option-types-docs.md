---
'@mastra/core': patch
---

Fixed the Observational Memory option types and their JSDoc. `observation.observeAttachments` now accepts a MIME type allowlist (`string[]`), matching the runtime and its default of `['image/*', 'application/pdf']`. The `model` option JSDoc now documents the real default, `'auto'`, instead of `'google/gemini-2.5-flash'`.
