---
'@mastra/core': patch
---

Fixed durable agents losing a pending approval on page refresh. The suspended tool's metadata is now persisted to the assistant message, so a reloading client re-renders the approval instead of showing none while the run sits parked and resumable.

This applies whenever the agentic loop executes in a different process than the one that called `stream()` — for example the `@mastra/inngest` `connect()` worker topology.
