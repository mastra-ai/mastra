---
'@mastra/core': patch
---

Fixes GPT-5 reasoning which was failing on subsequent tool calls with the error:

```
Item 'fc_xxx' of type 'function_call' was provided without its required 'reasoning' item: 'rs_xxx'
```
