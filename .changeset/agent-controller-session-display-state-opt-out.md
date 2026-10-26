---
'@mastra/server': patch
'@mastra/client-js': patch
---

Added an optional `displayState: false` setting to AgentController session subscriptions. Clients that only need lifecycle and task events can skip full display-state snapshots, including the initial snapshot, to reduce SSE bandwidth and serialization work. Existing subscriptions continue receiving snapshots by default.
