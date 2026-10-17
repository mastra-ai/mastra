---
'@mastra/code-sdk': patch
---

Improved the warning logged when a run has no signed-in user to resolve model credentials. It now includes the session and thread ids and the names of the request context entries, so the code path that started the run can be identified from logs.
