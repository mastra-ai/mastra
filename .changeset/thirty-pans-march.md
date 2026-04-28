---
'@mastra/core': minor
'@mastra/editor': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/pg': patch
---

Stored agents and skills now support a `visibility` field (`public` or `private`). Resources created by an authenticated user default to `private`; resources created without authentication default to `public`. Private resources are only accessible to their owner and admins.
