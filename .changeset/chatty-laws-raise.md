---
'@mastra/playground-ui': patch
---

Moved the tool-call classifier and grouping helpers (toolCardKind, badgeStatus, toolInteraction, collectToolGroups) into playground-ui so hosts can decide how each tool call is drawn and folded without depending on Studio internals.
