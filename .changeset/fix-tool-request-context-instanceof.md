---
'@mastra/core': patch
---

Fixed tool executions silently losing request context when a bundler or monorepo loads more than one copy of @mastra/core. Previously, a request context created by a different copy of the package was not recognized, so the tool received an empty context or the entries passed at execution time were dropped from the merge. Request context values now reach the tool regardless of which copy of the package created them. Closes #19772.
