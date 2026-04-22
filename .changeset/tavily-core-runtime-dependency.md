---
"@mastra/tavily": patch
---

Moved `@tavily/core` from `peerDependencies` to `dependencies`. The Tavily SDK is an internal implementation detail of this package (imported directly from `client.ts` at runtime), not a user-provided pluggable dependency like `@mastra/core` or `zod`. Declaring it as a peer dep required every consumer — including transitive consumers such as globally-installed CLIs — to install `@tavily/core` themselves, which caused `ERR_MODULE_NOT_FOUND: Cannot find package '@tavily/core'` at runtime. It is now installed automatically alongside `@mastra/tavily`.
