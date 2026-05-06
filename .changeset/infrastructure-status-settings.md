---
'@mastra/server': patch
'@mastra/client-js': patch
'@mastra/playground': patch
---

Add admin-only Infrastructure section to Studio Settings showing channels, browser, and workspace status. Adds `GET /editor/builder/infrastructure` route gated by new `infrastructure:read` permission, surfaces a Settings link in the user menu (Studio + Agent Builder).
