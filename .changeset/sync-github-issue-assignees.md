---
'@mastra/factory': patch
---

GitHub issue `assigned` and `unassigned` webhooks now update the linked card's assignees. Only issues that already have a card are updated; the card's board and stage stay the same, and no run is started.
