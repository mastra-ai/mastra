---
'@mastra/code-sdk': patch
---

Fixed Anthropic models not using prompt caching when they run through the Mastra Gateway with an organization key. Supported gateway routes can now reuse cached input on later steps of a conversation.
