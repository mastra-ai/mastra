---
'@mastra/core': patch
---

Fix `generateEmptyFromSchema` to accept both string and pre-parsed object JSON schema inputs, recursively initialize nested object properties, and respect default values. Updated `WorkingMemoryTemplate` type to a discriminated union supporting `Record<string, unknown>` content for JSON format templates. Removed duplicate private schema generator in the working-memory processor in favor of the shared utility.
