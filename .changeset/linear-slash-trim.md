---
'@mastra/core': patch
'@mastra/auth-supabase': patch
---

Fixed slow handling of Gateway base URLs and Supabase URLs that contain very long runs of `/`. The resulting URLs are unchanged.
