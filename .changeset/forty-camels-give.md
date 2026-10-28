---
'@mastra/core': minor
---

Added execution outcomes and typed stop-reason details to agent, model, tool, and workflow traces. Traces distinguish failures, cancellations, limits, guardrail blocks, and observer interruptions; TripWire errors now serialize with the name `TripWire` so they can be identified across workers.
