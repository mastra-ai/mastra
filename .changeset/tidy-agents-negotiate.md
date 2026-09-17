---
'@mastra/core': minor
'@mastra/server': minor
---

Add global and per-agent A2A protocol exposure configuration with `server.a2a.protocolVersions` and `server.a2a.agents[id].protocolVersions`. Overrides replace the global list, and an empty list disables A2A for that agent. Both versions remain enabled by default.

Agent discovery now selects a legacy or v1 card using `A2A-Version`, advertises only enabled interfaces in v1 cards, and includes `Vary: A2A-Version`. Missing headers continue to select v0.3. Disabled versions are rejected during both discovery and execution, and card signing covers the selected wire representation.
