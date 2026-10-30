---
'@mastra/code-sdk': patch
---

Fixed a misleading error when a deployed Mastra Code host could not bill a model call. A signed-in user whose organization id is not a string used to get "the request has no authenticated user"; they now get "the authenticated user's organization id is not a string". The thrown error also carries a `reason` (`missing-user-context`, `invalid-organization-id` or `no-policy-for-principal`), and `credentialTenantFailureReason(error)` from `@mastra/code-sdk/agents/credential-resolver` reads it back, so hosts no longer need to match the message. Refs [#28697](https://github.com/mastra-ai/mastra/issues/28697).
