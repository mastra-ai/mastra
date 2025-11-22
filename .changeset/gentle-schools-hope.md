---
'@mastra/core': patch
---

Adding support for accessing raw chunks from the AI SDK when streaming agent responses. Raw chunks contain provider-specific data that may be needed for advanced use cases, such as accessing Anthropic's inline citation metadata from the web search tool.
