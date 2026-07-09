---
'@mastra/code-sdk': minor
'mastracode': patch
---

Publish the Mastra Code agent core as `@mastra/code-sdk` (previously the internal `@internal/mastracode` package), so third parties can build their own UIs and surfaces on top of the Mastra Code coding agent. The `mastracode` CLI now consumes it as a regular runtime dependency instead of bundling it into its published output.
