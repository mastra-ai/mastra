---
'@mastra/code-sdk': patch
---

Added a 15s `AbortSignal` timeout to the Anthropic OAuth token-exchange and refresh fetches so an unresponsive upstream cannot pin the caller indefinitely.
