---
'@mastra/factory': patch
---

Sessions that start at the same time now share one GitHub token mint per repository instead of each minting their own, so busy projects stop hitting the Platform's per-installation mint rate limit and skipping repository syncs.
