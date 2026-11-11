---
'@mastra/code-sdk': patch
---

Fixed long requests ending the run as a "persistent outage" when the provider cut the response stream after accepting the request. One example is the 900-second stream limit on the ChatGPT Codex route. Mastra Code now retries a cut stream on the same account, up to twice per model step. If the stream is still cut, Mastra Code shows the original error. Your accounts are no longer marked unavailable.
