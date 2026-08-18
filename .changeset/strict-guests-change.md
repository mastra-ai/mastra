---
'@mastra/vectorize': patch
---

Fixed Cloudflare Vectorize updates inserting a duplicate vector under a random ID instead of replacing the requested one, and added support for deleting multiple vectors by ID. Deleting by metadata filter remains unsupported. (#21582)
