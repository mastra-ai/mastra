---
'@mastra/code-sdk': patch
'mastracode': patch
---

Fixed cross-agent thread ownership so peers advertise the mastracode instance that currently owns the thread instead of an instance that only visited it earlier.

Sessions still keep every loaded thread advertised so saved peers remain reachable after `/new`. When another instance requests a thread that is no longer current, the SDK now transfers its lease during that claim attempt and forgets the yielded advertisement. A thread that is still current is retained, and retries succeed as soon as its current owner moves away. This prevents stale titles, missing peers, timeout races during event-loop stalls, and release-before-reclaim gaps.
