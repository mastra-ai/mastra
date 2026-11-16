---
'@mastra/core': patch
'@mastra/auth-supabase': patch
'@mastra/factory': patch
---

Normalizing a configured URL (Gateway base URL, Supabase URL) or reading a pull request number from a card key now takes linear time, so very long runs of `/` or digits in those values no longer stall it. The results are unchanged.
