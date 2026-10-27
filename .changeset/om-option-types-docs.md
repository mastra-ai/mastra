---
'@mastra/core': patch
---

You can now choose which attachment types the Observational Memory Observer receives: `observation.observeAttachments` accepts a MIME type allowlist (`string[]`) in the public types, matching the runtime (images and PDFs by default). Also corrected the `model` option docs: the default is `'auto'`, falling back from the top-level `model` to the other sub-config's `model`, not `'google/gemini-2.5-flash'`.
