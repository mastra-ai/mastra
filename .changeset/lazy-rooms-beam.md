---
'@mastra/langfuse': patch
---

Fixed the Langfuse trace input being replaced by the tool-approval payload after an agent suspends for tool-call approval and resumes. The trace input now stays the original user message and the trace output is the final reply, so the Langfuse session and trace views show the real request and response for turns that paused for approval. Fixes [#23704](https://github.com/mastra-ai/mastra/issues/23704).
