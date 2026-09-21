---
'@mastra/core': patch
---

Fixed the TypeScript type for DurableAgent stream options to include providerOptions. Provider-specific options (like OpenAI reasoning settings) were already forwarded at runtime, but TypeScript rejected them when passed to stream() or generate() on a durable agent.
