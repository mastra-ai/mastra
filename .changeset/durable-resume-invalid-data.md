---
'@mastra/core': patch
---

Durable agents now reject `resume()` and `resumeStream()` data that fails the suspended tool's `resumeSchema` with `AGENT_RESUME_INVALID_DATA`, before the run is touched, when the resume reuses the run's registered tool (resumes that rebuild request-built tools, including `untilIdle`, behave as before). The run stays suspended, so a corrected retry still resumes it with the run's original request context.
