---
'@mastra/server': patch
---

Added support for thread ownership transfer (resourceId reassignment) in trusted server contexts. When `MASTRA_RESOURCE_ID_KEY` is not set by middleware, thread updates can now change the `resourceId` to transfer ownership between resources. When middleware sets the resource ID, ownership remains locked for multi-tenant security. See [#13327](https://github.com/mastra-ai/mastra/issues/13327).
