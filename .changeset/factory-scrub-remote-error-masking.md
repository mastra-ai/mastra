---
'@mastra/factory': patch
---

Fixed workspace opening failures reporting a confusing `ENOENT` / `The "cwd" option is invalid` error instead of the real cause. When a repository clone failed and left no working directory behind, the token cleanup that always runs afterwards crashed on the missing directory and replaced the original error. Blocked egress, bad credentials, or a missing repository now surface as the actual failure.
