---
'@mastra/core': patch
---

Fixed `stream.text` and the last step's `text` resolving to an empty string when an agent has an output processor and the run stops via `stopWhen` on a step that contains both text and a tool call. Output processors that intentionally clear text still work as before.
