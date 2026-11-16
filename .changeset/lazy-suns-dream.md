---
'@mastra/core': patch
---

Fixed web search on models served through the Mastra gateway. An agent using `webSearchTool` with a model such as `mastra/openai/gpt-6.1-sol` failed every turn with `unknown tool type "openai:web_search"`, and on Anthropic and Google models the tool was dropped without an error. These models now use the gateway's web search.

Other provider-native tools on gateway models now fail with a clear error. Previously the gateway rejected them with a 400 or ignored them, leaving the model without the tool.
