---
'@mastra/auth-neon': patch
---

Added `user` support for dynamic agent configuration callbacks: the provider now implements `toMastraUser()` so callbacks receive a correctly mapped `user` argument (id, name, email and avatar). `@mastra/auth-neon` now requires `@mastra/core` 1.80.0 or later.
