---
'@mastra/core': patch
---

Durable agents resumed from storage (for example after a restart, or on another server) now reject `resume()` and `resumeStream()` data that fails the suspended tool's `resumeSchema` with `AGENT_RESUME_INVALID_DATA`, before the run is touched. The run stays suspended, so a corrected retry still resumes it with the run's original request context.
