---
'@mastra/server': patch
---

Improved how the agent controller's SSE stream prepares events: the `Error` flattening and the display-state `Map` conversion now both apply to an event that needs both, instead of whichever matched first winning and skipping the other.
