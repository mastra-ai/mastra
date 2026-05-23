---
'@mastra/core': patch
---

Unix socket broker election now retries after stale election locks and transient connection failures so competing processes can recover without failing startup.
