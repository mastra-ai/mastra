---
'@mastra/core': patch
---

Fixed getWorkflowRunById and getWorkflowRunSteps so nested workflows report the correct single suspended leaf step. Obsolete suspension details are removed after the step resumes or completes. (#21229)
