---
'@mastra/core': patch
---

Fix provider-executed tools (like `openai.tools.webSearch()`) not working correctly with AI SDK v6 models. The agent's `generate()` method was ending prematurely with `finishReason: 'tool-calls'` instead of completing with a text response after tool execution.

The issue was that V6 provider tools have `type: 'provider'` while V5 uses `type: 'provider-defined'`. The tool preparation code now detects the model version and uses the correct type.
