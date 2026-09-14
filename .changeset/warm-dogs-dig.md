---
'@mastra/factory': patch
---

Fixed reused managed Factory sessions keeping stale observational-memory models: when automation reuses an existing managed session, the project's current observer and reflector model settings are now reapplied before the run, instead of silently keeping the models the session was originally created with. Also, when a run is aborted by a permanent observational-memory failure (for example a provider rejecting an unsupported model), the real error is now surfaced and the decision is marked as a non-retryable configuration failure instead of being retried behind a generic "aborted" message.
