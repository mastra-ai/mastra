---
'@mastra/server': minor
'@mastra/mcp-apps-components': patch
'@mastra/playground-ui': patch
'@mastra/client-js': patch
'@mastra/react': patch
---

Added the `observabilityProgressiveSearch` observability capability (`false` by default). Hosts whose observability API searches long ranges in chunks report `true` so Studio searches them chunk by chunk.
