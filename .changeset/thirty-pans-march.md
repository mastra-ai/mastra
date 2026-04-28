---
'@mastra/core': minor
'@mastra/editor': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
'@mastra/pg': patch
---

Added `visibility` field to stored agents and skills storage. Agents and skills created by an authenticated user default to `private`; resources created without authentication default to `public`. Private resources are readable only by their owner (or users with admin/scoped permissions). Setting `visibility: 'public'` makes a resource readable by any caller. All storage backends (libsql, postgres, mongodb) have been updated to persist and query the `visibility` field.
