---
'@mastra/core': minor
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Added request-context session state access so integrations can resolve persisted preferences for each request. Integrations can read `requestContext.get('controller')?.session.state.get()` and use the returned state when selecting request-specific behavior.
