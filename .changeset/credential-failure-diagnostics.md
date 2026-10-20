---
'@mastra/code-sdk': patch
---

Credential resolution failures (for example a run with no signed-in user) are now logged as errors through the Mastra instance's logger, so they appear in deployed logs. The missing-user error also includes the session and thread ids and the names of the request context entries, so the code path that started the run can be identified.
