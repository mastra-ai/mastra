---
'@mastra/core': patch
---

Show the model the real result of a background tool call

When a tool ran as a background task, the dispatch turn stored a "Background task started..." placeholder as the tool's model-facing output. Completion wrote the real result to the tool invocation, but the placeholder was carried through unchanged and continued to win when the prompt was built, so the model never saw the actual result and would re-dispatch the tool or answer without it.

The completion path now recomputes the model-facing output from the real result, and provider metadata is merged one level deeper so a single key can be replaced without dropping its siblings.
