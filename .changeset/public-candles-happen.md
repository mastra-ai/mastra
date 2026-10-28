---
'@mastra/factory': patch
---

Factory now tells apart the two reasons a run cannot bill its model calls. A start whose user has an organization id that is not a string fails with the new failure code `run_user_organization_invalid` instead of `run_user_unauthenticated`, so the failed card says which one happened. Both stop on the first attempt and are not offered Retry, since the same start fails the same way every time. A start refused before its run began used to be recorded as `unknown` and retried up to five times; it now gets the same failure code as a refusal during the run. Refs [#28697](https://github.com/mastra-ai/mastra/issues/28697).
