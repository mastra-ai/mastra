---
'@mastra/core': patch
---

Fixed Knowledge custom scopes granting ownership by default. Materializing an address that matches no configured scope type no longer gives the materializing context an `owner` grant on it. The built-in `org`, `resource` and thread scope types keep their owner grant. To give custom scopes owners, configure a `custom` scope type, for example `new Knowledge({ scopes: { custom: { access: [{ principal: 'self', role: 'owner' }] } } })`.
