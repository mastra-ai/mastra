---
'@mastra/code-sdk': patch
---

Fixed Anthropic models not using prompt caching when they run through the Mastra Gateway with an organization key. Requests now carry the same cache breakpoints as direct Anthropic connections, so repeated steps in a conversation read the earlier prompt from cache.
