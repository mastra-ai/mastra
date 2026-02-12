---
'@mastra/playground-ui': patch
---

Fix prompt experiment localStorage persisting stale prompts: only save to localStorage when the user edits the prompt away from the code-defined value, and clear it when they match. Previously, the code-defined prompt was eagerly saved on first load, causing code changes to agent instructions to be ignored.
