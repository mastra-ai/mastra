---
'@mastra/core': patch
---

**`createCodingAgent` now repairs recoverable bad requests instead of replaying them.**

The default error processors ran the blind stream retry first. It claims these rejections, so a request that `ProviderHistoryCompat` or `PrefillErrorHandler` knows how to fix was retried unchanged, earned the same rejection, and surfaced as a failed turn. Both repair processors now run ahead of it.

What changes for you: a coding agent hitting a malformed tool-call id or an assistant-prefill rejection now retries a corrected request rather than an identical one. The retry budget is unchanged.

Pass your own `errorProcessors` to opt out; the default list is only used when you pass none.
