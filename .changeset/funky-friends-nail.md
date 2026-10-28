---
'@mastra/core': patch
---

Fixed nested evented workflows running without the caller's `workflows:execute` permission on the child workflow. When a fine-grained authorization (FGA) provider is configured, non-internal nested workflows now require an authenticated user with that permission, or a trusted actor with tenant scope subject to the provider's actor policy. Internal child workflows remain exempt from this check.

Schedule-triggered runs carry no user identity or trusted actor by default. Scheduled workflows containing non-internal nested children therefore now fail closed when FGA is configured, matching the default engine's behavior.
