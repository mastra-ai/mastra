---
'@mastra/core': patch
---

Knowledge graph and tree reads now count child scopes in bulk, one storage call per 100 scopes, and list child scopes only under the scopes that have some. Previously they made one call per scope, so a Knowledge with many team or user scopes needed hundreds of storage calls per read. A graph read also stops looking up mentioned pages after 1,000 of them turn out deleted, and reports the graph as partial.
