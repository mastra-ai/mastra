---
'@mastra/redis-streams': patch
'@mastra/valkey-streams': patch
---

Agents publishing on Redis or Valkey Streams without a replay cache keep sending only the response messages that changed on each step, since a subscriber reads a topic's stream from its first entry.
