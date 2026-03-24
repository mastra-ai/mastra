---
'@mastra/memory': patch
---

Fixed observational memory reflection compression for `google/gemini-2.5-flash` by using stronger compression guidance and starting it at a higher compression level during reflection. `google/gemini-2.5-flash` is unusually good at generating long, faithful outputs. That made reflection retries more likely to preserve too much detail and miss the compression target, wasting tokens in the process.
