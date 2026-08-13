---
'@mastra/server': patch
---

Fixed the memory API returning other users' threads when server auth is configured without `mapUserToResourceId`. Previously an authenticated request that resolved to no resource ID listed, read and mutated every resource's threads instead of just its own. Those requests are now rejected with a 403.

Servers with no auth provider (local development and Studio) are unaffected, and callers holding a `memory:*` or `memory:admin` permission can still enumerate across resources.

Resolves https://github.com/mastra-ai/mastra/issues/18911
