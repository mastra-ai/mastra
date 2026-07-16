---
'@mastra/code-sdk': minor
'mastracode': patch
---

Added plugin signal providers so plugins can contribute processors and tools through Mastra's signal API. Providers reload without replacing active coding sessions, and can release resources with an optional dispose method. Mastra Code now also hydrates objectives created through the Agent API before rendering goal evaluations, so signal-provider goals share the existing status, pause, and judge UI.
