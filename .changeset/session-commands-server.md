---
'@mastra/server': minor
---

The session state route accepts an optional `unset` key list so clearing a key merges atomically with other updates. Goal set/update routes accept `trigger: boolean`; triggering sends the goal reminder once, and a failed start pauses the goal and answers 502 `goal_trigger_failed`.
