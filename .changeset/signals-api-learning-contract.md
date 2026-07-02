---
'@mastra/playground-ui': patch
---

Fix the Signals (Agent Learning) client to call the platform query service's session-authenticated `/api/learning/*` routes instead of the internal `/entity-learning/*` output-service contract. The client now derives the query-service origin from the injected observability endpoint, sends the WorkOS session cookie via `credentials: 'include'`, and scopes reads with the `X-Mastra-Project-Id` header — matching the existing `/api/observability/*` auth pattern. Previously the Signals UI called an internal-only endpoint with no credentials, which 404'd on every hosted and local deployment.
