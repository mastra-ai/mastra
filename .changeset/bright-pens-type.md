---
'@mastra/core': patch
---

Added `isProviderDefinedTool` helper to detect provider-defined AI SDK tools (e.g. `google.tools.googleSearch()`, `openai.tools.webSearch()`) for proper schema handling during serialization.
