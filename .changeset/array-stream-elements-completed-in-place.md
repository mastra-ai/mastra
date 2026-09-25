---
'@mastra/core': patch
---

Fixed array structured output `textStream` and `elementStream` dropping fields that a later streaming chunk adds to the trailing element. With token-by-token provider streaming, the trailing element of each object chunk is still partial and is completed by a later chunk; the streams previously kept the partial version (for example `{"a":1}` instead of `{"a":1,"b":2}`), so the streamed array diverged from the final validated object. Both streams now publish an element only once a following element (or the end of the stream) proves it complete.
