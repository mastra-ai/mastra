---
'@mastra/core': patch
---

Fixed unclear errors for Mastra Gateway models (`mastra/<provider>/<model>`) when `MASTRA_GATEWAY_API_KEY` isn't set.

- Agents now fail with `Set MASTRA_GATEWAY_API_KEY to use "mastra/openai/gpt-5-mini" through Mastra Gateway.` instead of `Could not find config for provider mastra`.
- Agents using `webSearchTool` no longer fail with `Could not infer a supported provider from "mastra"`: the tool reads the provider after the `mastra/` prefix.
