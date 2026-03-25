---
'@mastra/daytona': patch
---

Fixed sandbox lookup to use Daytona sandbox ID via get() instead of the deprecated findOne() method. Reconnection now uses the stored Daytona sandbox ID when available, falling back to sandbox name for cross-process reconnection.
