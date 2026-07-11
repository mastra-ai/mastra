---
'@mastra/code-sdk': minor
'mastracode': patch
---

Added plugin signal providers so plugins can contribute processors and tools through Mastra's signal API. Providers reload without replacing active coding sessions, and can release resources with an optional dispose method.
