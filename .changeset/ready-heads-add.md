---
'@mastra/server': patch
---

Fixed pending-message recovery by adding an opt-in `includeActiveInput` query parameter to agent-controller thread message reads. Active input is returned separately from stored history and its pagination.
