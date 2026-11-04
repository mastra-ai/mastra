---
'@mastra/code-sdk': patch
---

Fixed long requests ending the run as a "persistent outage" when the provider cut the response stream after accepting the request, such as the 900-second stream limit on the ChatGPT Codex route. Mastra Code now retries these cuts on the same account up to twice, then shows the original error, and no longer marks your accounts unavailable.
