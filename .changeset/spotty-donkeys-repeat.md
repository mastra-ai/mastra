---
'@mastra/core': patch
---

Fixed tool result metadata being dropped when a UI message comes back from the browser. The AI SDK sends this metadata separately from the call-time metadata, and only the call half was read, so the `toModelOutput` projection stored on a tool result was lost and the raw result was rendered back into the prompt.

Fixes [#22012](https://github.com/mastra-ai/mastra/issues/22012)
