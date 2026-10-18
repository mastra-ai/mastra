---
'@mastra/server': patch
---

The agent signal and message routes (`send-signal`, `send-message`, `queue-message`, `queue-signal`) now accept top-level `requestContext` and `tracingOptions` in the request body. Signals that wake an idle thread without `ifIdle.streamOptions` now go through the agent's `wakeOptions` hook. Before, the server always filled in `ifIdle.streamOptions`, so HTTP callers never reached the hook.
