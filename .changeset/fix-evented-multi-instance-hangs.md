---
'@mastra/core': patch
---

Fix multi-instance evented-mode hangs caused by transport edge cases.

Four related fixes that stop `agent.generate()` from hanging silently when multiple processes share a Unix socket pubsub broker:

- **Broker election race (`EEXIST`)**: `UnixSocketPubSub#start()` now falls through to client mode when `listen()` throws `EEXIST` on macOS for a path that already exists as a regular file, matching the existing `EADDRINUSE` fallback.
- **Local nack redelivery**: `#deliverLocal` now passes real `ack`/`nack` callbacks; nacked events are re-queued via `setTimeout` so consumer-side retries (e.g. SQLITE_BUSY backoff) can drain instead of being silently dropped.
- **Broker-death retry (`EPIPE`)**: `#sendToBroker` retries up to 3 times with re-election between attempts so an in-flight publish survives a broker crash and re-election rotation.
- **Workflow retry exhaustion surfaces terminally**: `WorkflowEventProcessor.handle` now tracks per-event delivery attempts and, after exhausting transport-level retries, publishes `workflow.fail` instead of returning `{ retry: true }` forever. This unblocks any caller awaiting `workflows-finish` (e.g. `agent.generate()`) so the original error reaches the user rather than hanging.
- **Workflow-event push subscription propagates nack**: the `'workflows'` topic callback in `Mastra` now calls `nack()` when the processor returns `{ ok: false, retry: true }`, enabling the transport-level redelivery loop above.
