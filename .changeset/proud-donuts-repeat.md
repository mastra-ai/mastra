---
'@mastra/core': patch
---

Fixed background tool calls so the model sees the completed result instead of the dispatch placeholder.

An agent that dispatched a tool to the background kept reading "Background task started..." on every later turn, so it would re-run the tool or answer without the result. Unrelated provider metadata on the tool call is now preserved when the completed result arrives.
