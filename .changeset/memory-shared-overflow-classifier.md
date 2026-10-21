---
'@mastra/memory': patch
---

Fixed observational memory's context-overflow detection to read the shared provider-error classifier from `@mastra/core/error`, so a provider wording added there is recognized by observational memory without a memory release. The set of recognized overflow wordings is unchanged. Requires @mastra/core 1.79.0 or newer.
