---
'@mastra/inngest': patch
---

Fixed resumed Inngest workflows and durable agents keeping the user who started the run. Resuming now takes the authenticated user, roles and permissions only from the request doing the resuming, so a resume without a signed-in user no longer sees the original user in `requestContext` or in the `user` argument of dynamic agent options.

`@mastra/inngest` now requires `@mastra/core` 1.82.0 or later.
