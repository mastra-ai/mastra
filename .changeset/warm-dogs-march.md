---
'@mastra/server': patch
'@mastra/deployer': patch
---

Fixed `requestContext.get('user')` returning `undefined` in `server.middleware` handlers before `next()`. The authenticated user is now available in middleware for both built-in and custom routes, enabling patterns like user isolation and per-user resource scoping as documented.
