---
'@mastra/schema-compat': patch
---

Fixed OpenAI structured output requests failing when a schema uses `z.record()`. The OpenAI compatibility layer now removes the `propertyNames` keyword, which OpenAI strict mode does not permit. Requests that used to fail with "Invalid schema ... 'propertyNames' is not permitted" are now accepted.

**Known limitation.** OpenAI strict mode cannot express an open-ended map. A `z.record()` field is still sent as a plain object with no value schema, so the model is not told what keys or values to produce. Use an explicit `z.object({ ... })` shape when you need the model to fill a map. See [#19273](https://github.com/mastra-ai/mastra/issues/19273).
