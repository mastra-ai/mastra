---
'@mastra/core': patch
---

Fixed webSearchTool failing on Mastra Gateway models (`mastra/<provider>/<model>`) when `MASTRA_GATEWAY_API_KEY` isn't set. Every message failed with "Could not infer a supported provider from "mastra"", which hid the real setup problem. The tool now reads the provider after the `mastra/` prefix, so the agent reports the same error it would without the tool.
