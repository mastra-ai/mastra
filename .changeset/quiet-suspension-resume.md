---
'@mastra/core': patch
---

Answering the same suspended tool call twice at once now resumes the run only once. A duplicate answer is ignored instead of failing with "another resume of it already claimed it" or "could not find a suspended run", so followers no longer get a false failure.
