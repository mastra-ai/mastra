---
'@mastra/core': patch
---

Fixed an infinite agent loop when a provider stream ends with finish reason "other" without producing any output. The agentic loop previously re-issued the identical request until maxSteps was reached, silently burning tokens. Such zero-output streams are now treated as a stream error so error processors can retry a bounded number of times before failing loudly. Streams that finish with reason "other" after producing output continue as before. Fixes #21897
