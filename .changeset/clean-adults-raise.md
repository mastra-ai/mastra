---
'@mastra/core': patch
---

Improved observational memory progress restoration by rebuilding UI status from the durable memory record instead of polluted message history. Restored progress now also reports the memory thresholds you configured, where it previously always showed the built-in defaults.
