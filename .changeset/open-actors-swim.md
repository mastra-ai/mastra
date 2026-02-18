---
'@mastra/koa': patch
---

Fixed shared server adapter test suite failures caused by missing path parameter mappings, test entities, and editor mocks for recently added routes (stored MCP clients, prompt blocks, workspaces, skills, scorer versions, tool providers). Also excluded dataset and skill-publish routes that require storage domains not available in InMemoryStore.
