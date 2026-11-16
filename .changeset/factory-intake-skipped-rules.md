---
'@mastra/factory': minor
---

Added `GET /web/factory/projects/:id/intake/skipped`. For each card-move rule that matched an event but was skipped because its target couldn't take the card, it returns how often that happened in the last 30 days and the newest skip.
