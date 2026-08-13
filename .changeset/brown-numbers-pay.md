---
'@mastra/core': patch
---

Fixed processOutputResult receiving an empty messages array after mid-run memory saves drained the live response set. Output processors now see this turn's response messages from both live and already-persisted response sets (#21204).
