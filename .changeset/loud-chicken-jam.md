---
'mastra': minor
---

Added `mastra api learning` commands for querying Trace Intelligence (private beta) from the CLI. You can now list entities with theme output, browse analysis snapshots, read cross-signal theme flows and per-trace paths, and drill into individual themes, examples, history, and noise buckets — without writing curl requests against the platform API.

```bash
# Discover agents with Trace Intelligence output
mastra api learning entities '{"entityType":"agent"}'

# List analysis snapshots for an agent
mastra api learning snapshots my-agent '{"entityType":"agent","signalNames":"goal,outcome,behavior,sentiment"}'

# List themes for one trace signal in one snapshot
mastra api learning theme list my-agent '{"entityType":"agent","signalName":"goal","snapshotId":"<snapshotId>"}'
```

The commands target the hosted Trace Intelligence service and resolve credentials the same way as other observability commands.
