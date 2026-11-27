---
'@mastra/core': patch
---

Added `resultType: 'title_generation'` to the trace span of the model call that generates a thread title, so observability exporters can tell it apart from the conversation.
