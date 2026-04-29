---
'@mastra/core': patch
---

Fixed prompt-only processor context so model prompt changes stay isolated from canonical history and API-error retries can update the failed prompt.
