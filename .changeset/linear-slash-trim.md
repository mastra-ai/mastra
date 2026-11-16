---
'@mastra/core': patch
'@mastra/auth-supabase': patch
---

Trimming trailing slashes from a configured Gateway base URL or Supabase URL now takes linear time, so a very long run of `/` in the URL no longer stalls it. The resulting URL is unchanged.
