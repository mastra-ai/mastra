---
'mastra': patch
---

`mastra api factory decision queue` now returns each run's `lane`, `queuedByLane`, and the reply reserve in `slots.interactive`. A waiting reply from a person is listed before the automated runs, and `position` counts within the run's lane:

```bash
mastra api factory decision queue <project-id>
```

```json
{
  "slots": { "scope": "server", "inUse": 10, "cap": 10, "interactive": { "inUse": 2, "cap": 2 } },
  "queuedCount": 2,
  "queuedByLane": { "automated": 1, "interactive": 1 },
  "queued": [
    { "lane": "interactive", "position": 1, "type": "sendMessage" },
    { "lane": "automated", "position": 1, "type": "invokeSkill" }
  ]
}
```

The board's run queue lists waiting replies from people first, under their own heading, and shows how many reply slots are in use.
