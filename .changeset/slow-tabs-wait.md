---
'@mastra/server': patch
---

Fixed agent controller event streams using more and more memory when a client reads slower than the session sends events, for example a laptop going to sleep, a poor network, or a server under heavy load. The server now holds a bounded backlog for each client:

- A client that falls behind still gets every event, in order, but only the newest `display_state_changed` snapshot instead of one per update. A client that keeps up receives exactly the same events as before.
- A stream with 5,000 events waiting, or an event waiting more than 60 seconds, is closed. `@mastra/client-js` with `reconnect: true` reconnects and receives the current display state first.
- Two new metrics, `mastra_agent_controller_sse_snapshots_dropped_total` and `mastra_agent_controller_sse_slow_client_closes_total`, report how often this happens.
