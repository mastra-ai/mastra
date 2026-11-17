---
'@mastra/factory': minor
'mastra': patch
---

Added moving a Factory card to another board by hand. Naming another installed board in the work-item transition endpoint now moves the card there, keeping its id, history, and sessions; the board UI offers it under a card's "Move to board" menu. A busy card stays put until its run ends, and a finished card stays on its own board.

```http
POST /web/factory/projects/:projectId/work-items/:workItemId/transition
```

```json
{
  "board": "oss-features",
  "stage": "backlog",
  "expectedRevision": 4,
  "requestId": "7f0a2c7e-9b1d-4a53-8c43-2f5d6e8a9b01",
  "cause": "move_to_board"
}
```
