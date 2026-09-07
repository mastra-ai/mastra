---
'@mastra/server': patch
'@mastra/core': patch
---

Fixed a security issue where any authenticated user could list and read other users' memory threads when auth was configured without mapUserToResourceId. Memory routes now require a server-derived resource ID and return 403 when one cannot be determined. Set server.memory.requireResourceScope to false to keep the previous unscoped behavior.
