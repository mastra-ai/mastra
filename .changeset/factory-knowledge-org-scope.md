---
'@mastra/factory': minor
---

Added `knowledgeOrgScope` for a Knowledge instance that declares only one org. Sessions and the Knowledge page then act as that `org:` scope instead of their own `org:` and `project:` scopes, so all projects share it.

```ts
new MastraFactory({ knowledge: new PlatformKnowledge({ tools: true }), knowledgeOrgScope: 'org:acme' });
```
