---
'@mastra/core': patch
---

- Preserved durable and evented agent behavior while reorganizing execution lifecycle internals. Existing durable replay records remain readable after upgrading.
- Fixed stream cleanup so older readers preserve resumed runs and current readers can release completed runs.
- Prevented duplicate completion callbacks when terminal events arrive concurrently.
- Kept idle timeouts active after ignoring terminal events from an earlier execution.
