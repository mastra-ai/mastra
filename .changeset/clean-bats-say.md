---
'@mastra/core': minor
'mastracode': minor
---

Added tools for explicitly connecting and disconnecting MastraCode agents and sending prioritized signals between freshly advertised peer threads, with clear discovered, connected, and saved states, correlated messages, retry identity backed by receiver-side notification coalescing, routing-aware expected-reply semantics, reactive reply reminders, precise routing outcome reporting, fenced thread-owner wake delivery, and pubsub-based peer discovery support. Cross-agent communication is experimental and off by default; enable it via the "Experimental cross-agent communication" toggle in `/settings` (restart required).
