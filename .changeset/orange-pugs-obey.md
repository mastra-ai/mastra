---
'@mastra/core': patch
---

Fixed agent channels so initialization runs after Mastra construction and startup failures are logged instead of being silently swallowed. Fixes #17692.
