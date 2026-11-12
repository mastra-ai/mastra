---
'@mastra/auth-cloud': patch
'@mastra/auth-supabase': patch
'@mastra/auth-better-auth': patch
---

Added `user` support for dynamic agent configuration callbacks: the provider now implements `toMastraUser()` so callbacks receive a correctly mapped `user` argument (id, name, email, avatar, and role where available).
