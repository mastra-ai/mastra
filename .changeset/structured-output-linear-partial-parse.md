---
'@mastra/core': patch
---

Fixed long structured-output streams freezing the server. A model that kept streaming after its JSON could stall the server for minutes. Large streams now send partial objects less often while streaming. The final object is unchanged.
