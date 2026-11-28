---
'@mastra/core': minor
---

Added automatic Knowledge identities for agents. Spread `knowledgeAgentScopes()` into your Knowledge `scopes` and every agent run holds `agent:<agentId>`, its per-org and per-user forms, and role and team scopes read from `metadata.persona`. These identities grant nothing until an access rule names them.

```ts
const knowledge = new Knowledge({ storage, scopes: { ...knowledgeMemoryScopes(), ...knowledgeAgentScopes() } });
const agent = new Agent({ ...config, metadata: { persona: { name: 'Sam', role: 'support', teamId: 'billing' } }, knowledge });
```

`knowledgePersonaScopes()` adds a read-only convention on top: each agent reads its own `#persona` page, and every agent of a role or team reads that scope's `#rules` page, pinned into context. Pass `agent:persona:role:<role>:edit` or `agent:persona:team:<teamId>:edit` in a run's scopes to let a specific agent edit those rules. Pinning to a shared role or team audience now needs editor access there.

`mergeAgentPersona(metadata, persona)` overrides `metadata.persona` field by field for static or function metadata, so a host can set a persona without losing the code's other metadata.
