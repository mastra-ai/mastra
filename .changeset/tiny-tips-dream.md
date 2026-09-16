---
'@mastra/core': patch
---

Fixed durable agents on cross-process engines (like Inngest) dropping requestContext values written by input processors. The request context snapshot that gets serialized into the durable workflow input was taken before input processors ran, so any `requestContext.set(...)` call inside an input processor never reached tools or scorers executing on a separate worker process. The snapshot is now taken after input processors run, while framework-internal entries (model version overrides, memory instances, auth tokens) are still kept out of the persisted input. Fixes [#23904](https://github.com/mastra-ai/mastra/issues/23904)
