---
'@mastra/factory': patch
---

Anonymous callers can no longer browse files, list artifacts or resolve codebase paths in a Factory deployment with authentication enabled; those routes now require a signed-in user. Factories running without authentication, such as local installs, are unchanged.
