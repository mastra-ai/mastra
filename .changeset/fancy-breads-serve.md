---
'@mastra/core': patch
---

Fixed structured output on durable agents using the evented engine. Schemas passed as `structuredOutput.schema` now stay available on later model calls and after a run is recovered. Workflow options that cannot be saved now fail with an error naming the field.
