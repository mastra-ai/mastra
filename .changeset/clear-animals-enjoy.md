---
'@mastra/factory': patch
---

Fixed board listing revalidation to use SHA-256, so a changed board is not treated as unchanged. Sandbox clone, checkout, environment sync, push, and merge-request refresh now refuse repository paths that resolve to a different repository, and default branch names that are not valid git refs.
