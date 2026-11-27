---
'@mastra/core': patch
---

Fixed an approved tool call running with the starting caller's tools when a different caller resumes the run. Durable, evented, and Inngest agents now run the approved call with tools built for the resuming caller, on the same server, on another server or worker, and after crash recovery. A plain `Agent` resume does the same. If the resuming caller's tools do not include the pending tool, the call fails with a tool error instead of running as the starting caller.

A resume now rebuilds tools from what it passes, so a pending call to a call-time `toolsets` tool fails unless the resume passes that toolset again.
