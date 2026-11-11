---
'@mastra/core': minor
---

**Breaking (Knowledge alpha):** a `$param` in a Knowledge scope pattern now matches exactly one segment, so scope values can no longer contain a raw `:`. Before, the last param took the rest of the address, so `org:acme:viewer` counted as an `org:$orgId` scope and its holder got that pattern's `self` rights there.

- Agent `scopes` are canonical addresses. An id containing `:`, `/`, `#` or `%` must be encoded with the new `encodeKnowledgeScopeId`. The raw form (e.g. `org:a:b` against `org:$orgId`) fails with "does not match a declared scope type", and `%` is always read as an escape, so each scope has one spelling.
- Memory ids are bound encoded: resource `slack:U123` becomes `resource:slack%3AU123`.
- Patterns of one type with different segment counts no longer overlap, so `org:$orgId` and `org:$orgId:viewer` can be declared side by side.
- `decodeKnowledgeScopeId` reads an id back from one segment of an address.

```ts
import { encodeKnowledgeScopeId } from '@mastra/core/knowledge';

const scope = `org:${encodeKnowledgeScopeId('auth0|a:b')}`; // 'org:auth0|a%3Ab', pass this in Agent scopes
```

No data is rewritten:

- **Colon ids get new addresses.** Pages, pins and notes stored under a resource, thread or other scope whose id contains a colon stay at their old address. A run holding the encoded id (`resource:slack%3AU123`) reaches a new, empty scope. Ids with `/`, `#` or `%` were already encoded and keep their addresses; pass them encoded.
- **Stale rows get nothing from their new match.** A stored scope row whose address now matches a different declaration than the one it was created under (e.g. `org:acme:viewer` created under `org:$orgId`, once `org:$orgId:viewer` is declared) gets none of the new declaration's access. It is never a `belongsTo` parent, and using it as a scope of the new declaration fails with an error. Prefix grants of the declaration it was created under still let their holders read it, as before, without a role on it.
