---
'@mastra/core': patch
---

Fixed durable agents on cross-process engines (like Inngest) dropping `requestContext` values written by input processors.

Values set with `requestContext.set(...)` inside an input processor now reach tools and scorers running on a separate worker process. Framework-internal entries (model version overrides, memory instances, auth tokens) are still kept out of the persisted workflow input. Fixes [#23904](https://github.com/mastra-ai/mastra/issues/23904)
