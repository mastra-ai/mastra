---
'@mastra/core': patch
---

Fixed approving a tool inside a background sub-agent. The sub-agent now resumes and runs the approved tool, instead of starting over and asking for approval again.
