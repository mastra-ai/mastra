---
'@mastra/core': patch
---

Send Azure OpenAI structured-output requests that contain a free-form object, such as `z.record()`, as non-strict requests. Azure models that default to strict JSON schema mode no longer reject them, and an explicit `strictJsonSchema` is still sent as the caller set it.
