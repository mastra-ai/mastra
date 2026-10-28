---
'@mastra/core': patch
---

Fixed nested evented workflows running without the caller's `workflows:execute` permission on the child workflow. Nested workflows now require an authenticated user with that permission, or a trusted actor with tenant scope subject to the FGA provider's actor policy, when an FGA provider is configured.

Schedule-triggered runs carry no user identity or trusted actor by default. Scheduled workflows containing nested children therefore now fail closed when FGA is configured, matching the default engine's behavior.
