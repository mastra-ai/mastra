---
'@mastra/core': patch
---

Fix tool outputSchema validation to allow unsupported Zod types like ZodTuple. The outputSchema is only used for internal validation and never sent to the LLM, so model compatibility checks are not needed.
