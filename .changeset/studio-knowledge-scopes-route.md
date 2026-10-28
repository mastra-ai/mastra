---
'@mastra/server': minor
'@mastra/client-js': minor
---

Added `GET /knowledge/:knowledgeKey/scopes`, which lists the distinct scope tag sets carried by an instance's live nodes and records, with node and record counts for each. A viewer can now pick a scope that holds data instead of guessing tags. The route is part of `KNOWLEDGE_ROUTES` and gated by `knowledge:read`. A caller with a bound scope (`MASTRA_KNOWLEDGE_SCOPE_KEY`) sees only the sets inside it; with an RBAC or FGA provider configured, an unbound caller is refused with a 403, as on the other Knowledge reads.

```ts
const { sets, truncated } = await client.getKnowledge('default').scopes();
// sets: [{ scope: ['org:acme'], nodeCount: 12, recordCount: 30 }, ...]
```
