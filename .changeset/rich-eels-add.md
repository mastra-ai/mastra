---
'@mastra/core': patch
---

Fixed `observe()` sending duplicate frames and dropping the start of a run when it reconnects over a transport that retains its history (Redis Streams, Unix sockets).

Events published by evented durable steps are now numbered through the shared cache before they reach the transport, so a replay is treated like any other frame: the requested offset is respected and each event is counted once. A process that reconnects with an empty cache can rebuild the run from the transport's retained history, and two workers can number their events in either order without one being discarded. Two caching tiers that share a cache but not a transport no longer store the same frame twice, so replaying that run carries it once. Events numbered inside a single process keep the previous ordering behaviour, so a stale frame from a discarded model attempt is still withheld. When a topic's cached history is out of order, or its list expired while its counter survived, the subscriber re-reads what is there instead of returning a partial or empty window.

Numbering is only enabled when the cache allocates the index and appends the entry in one atomic step; on other caches events stay unnumbered and are deduplicated by id. During a rolling deploy an API process that has not upgraded yet receives the new frames without a numeric index and forwards them exactly as it does today, instead of dropping them as stale. The durable agent's observe subscription removes the new sequence metadata before handing an event to the caller, so the payload `POST /agents/:id/observe` forwards is unchanged.
