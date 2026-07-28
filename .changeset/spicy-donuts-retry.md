---
'@mastra/platform-workspace': patch
---

Retry sandbox creation on transient workspace-proxy 5xx responses. Provisioning intermittently fails with proxy 500s while the provider is under load; a short backoff-and-retry keeps a single flaky window from failing the caller's whole workflow (e.g. Factory kickoff runs). Non-transient errors (4xx) still fail immediately.
