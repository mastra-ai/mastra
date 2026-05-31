---
'mastracode': patch
---

Fixed the `ask_user` tool's `multi_select` mode in Mastra Code, which previously rendered as a single-select list and returned only one answer.

When an agent calls `ask_user` with `selectionMode: "multi_select"`, the CLI now shows a multi-select picker — press Space to toggle each option and Enter to confirm — and returns every selected label to the agent as an array instead of a single string.
