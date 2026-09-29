---
'@mastra/core': patch
---

Fixed cross-agent wakes with `requireClaimedOwner` failing with "No claimed thread owner responded" when the owning agent was alive but slow to answer (for example on a busy host or CI). Owner discovery for wakes now retries with growing timeouts for up to 1 second before giving up, and the error states how long it waited.

Both limits can be tuned with environment variables:

- `MASTRA_AGENT_THREAD_OWNER_DISCOVERY_TIMEOUT_MS` — per-attempt wait (default `100`)
- `MASTRA_AGENT_THREAD_WAKE_OWNER_DISCOVERY_DEADLINE_MS` — total wake discovery budget (default `1000`)
