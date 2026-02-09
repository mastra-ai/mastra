---
'@mastra/core': patch
---

Fixed routing output so users only see the final answer when routing handles a request directly. Previously, an internal routing explanation appeared before the answer and was duplicated. Fixes #12545.
