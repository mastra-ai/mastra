---
'@mastra/core': patch
---

Fixed `textStream` and `elementStream` returning incomplete array elements when streaming structured output with an array schema. Previously, if an element arrived across several tokens, the streams could keep an early partial version (for example `{"a":1}` instead of `{"a":1,"b":2}`) that didn't match the final `object`. Each element is now emitted only once it is complete, so the streamed elements always match the final result.
