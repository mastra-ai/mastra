---
'@mastra/react': patch
---

Fixed experiment cost going missing after a run. Usage now loads once the experiment finishes, and retries briefly while the final metrics are still being recorded.
