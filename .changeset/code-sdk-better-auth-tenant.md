---
'@mastra/code-sdk': patch
---

Fixed tenant credential resolution when the request context carries a better-auth `{ session, user }` wrapper. Background Factory runs no longer fail closed with "Not logged in" despite valid stored credentials. Fixes [#20887](https://github.com/mastra-ai/mastra/issues/20887).
