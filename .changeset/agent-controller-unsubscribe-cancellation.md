---
'@mastra/client-js': patch
---

`AgentControllerSession.subscribe()` now honors `unsubscribe()` at every await and dispatch boundary, so a detached subscriber no longer receives stale session state or leaks a response body. Four cancellation races are fixed: an `onEvent` dispatched from a `reader.read()` that resolved just before unsubscribe; further buffered frames dispatched after an `onEvent` handler unsubscribes mid-chunk; the freshly fetched reconnect response body left open when `onReconnect` unsubscribes; and an `onError` fired when a reconnect request rejects after unsubscribe. Fixes #23454.
