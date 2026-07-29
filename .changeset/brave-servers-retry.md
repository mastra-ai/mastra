---
'@mastra/code-sdk': patch
'mastracode': patch
---

Extended Mastra Code's transient retry policy to cover provider server errors with up to 10 retries and exponential backoff starting at 500ms.
