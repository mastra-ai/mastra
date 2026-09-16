---
'@mastra/core': patch
---

Fixed workspace `requireReadBeforeWrite` falsely rejecting writes with "has not been read" after suspend/resume and between conversation turns (#23772). Read records now persist per memory thread in the `threadState` storage domain — the same store that holds task lists and goal objectives — so a file read before a tool suspends (for example, awaiting plan approval or a `requireApproval` tool) no longer needs a wasteful re-read after the run resumes, including on serverless runtimes where the process is torn down between suspend and resume. No configuration is needed: any configured storage adapter provides durable records, and runs without a memory thread or Mastra storage fall back to per-run tracking. Files modified on disk after being read still require a re-read before writing.
