---
"@mastra/core": patch
---

Fixed AI SDK v6 provider tools (like `openai.tools.webSearch()`) not being recognized correctly. The tool builder now checks for both `type: 'provider'` (v6) and `type: 'provider-defined'` (v5) when identifying provider tools.

Previously, v6 provider tools were incorrectly converted to regular function tools, causing the provider tool pipeline to fail.
