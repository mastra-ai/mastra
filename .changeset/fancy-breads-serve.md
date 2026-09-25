---
'@mastra/core': patch
---

Fixed structured output on durable agents using the evented engine. A Zod schema passed as `structuredOutput.schema` was lost between workflow steps, so the second model call sent an empty schema: OpenAI rejected it with a 400, and recovered runs silently returned `object: null`. The schema is now converted to plain JSON Schema before the run starts, and durable workflow options are validated to reject values that cannot survive serialization.
