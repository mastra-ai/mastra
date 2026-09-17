---
'@mastra/core': patch
---

Fixed attachment download failures bypassing error processors in regular agent runs. Processors can now repair the message context and retry when a historical attachment becomes unavailable.
