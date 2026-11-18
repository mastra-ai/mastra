---
'@mastra/memory': patch
---

Reduced the CPU that observational memory spends on long threads with large tool results. Observing a thread of about 90 messages and 2.4MB now takes about a tenth of the main-thread CPU it took before (2.2s down to 0.24s), and each agent turn on such a thread uses about 13ms of CPU instead of 110ms. This keeps the event loop free for other requests when many large threads are active in one process. Observer input and token counts are unchanged.
