---
'@mastra/core': patch
---

Fixed long structured-output streams freezing the server. A model that kept streaming after its JSON could stall the server for minutes.

For structured outputs over ~4 KB, partial objects are now emitted at a throttled rate instead of on every text chunk. The final object and short outputs are unchanged.
