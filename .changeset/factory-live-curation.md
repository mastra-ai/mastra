---
'@mastra/memory': patch
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Make subconscious curation run inside short-lived factory sessions. The manual `om.reflect()` path now carries the same concurrency and stale-flag guard as turn-driven reflection, so concurrent or stale manual reflections no longer double-run. A new config-gated `pins.capturePinning` flag (off by default) lets the capture agent pin durable user preferences and hard constraints at observation time through the shared budget-enforced pin path, and the curator's pin instructions now require pinned knowledge to be both costly to rediscover and not the kind of thing a future agent would search for. The factory fires a fire-and-forget reflection cycle whenever a work item changes phase, and factory sessions built through the code sdk enable capture-time pinning with a factory-aware memory cache key.
