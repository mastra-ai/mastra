---
'@mastra/factory': patch
---

Factory no longer retries a skill run that failed because its request had no authenticated user ("Tenant model credential policy could not be resolved: the request has no authenticated user."). That error came back on every retry, so the run used up all its attempts before a person saw it. It now fails on the first attempt with the non-retryable failure code `run_user_unauthenticated` and shows up in attention right away. A person needs to start it again. Provider 401/403 errors are still recorded as `run_credentials_unavailable` and are still retried.
