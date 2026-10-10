---
'@mastra/factory': patch
---

Fixed label routing reopening done or canceled cards when their board is not installed. For example, Work cards in an app that sets `includeDefaultBoards: false` were moved onto a custom board when a label route changed. Cards on an uninstalled board now stay where they are.
