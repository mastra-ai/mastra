---
'@mastra/core': minor
---

**Breaking (Knowledge alpha):** a `$param` in a Knowledge scope pattern now matches exactly one segment, so scope values can no longer contain a raw `:`. Before, the last param took the rest of the address, so `org:acme:viewer` counted as an `org:$orgId` scope and its holder got that pattern's `self` rights there.

- Colons in ids are encoded as `%3A`, in every param. Memory ids are bound encoded: resource `slack:U123` becomes `resource:slack%3AU123`.
- A raw run scope whose value contains a colon (e.g. `org:a:b` against `org:$orgId`) now fails with "does not match a declared scope type".
- Patterns of one type with different segment counts no longer overlap, so `org:$orgId` and `org:$orgId:viewer` can be declared side by side.
- New `encodeKnowledgeScopeId` / `decodeKnowledgeScopeId` helpers build and read one segment of a canonical address.

```ts
import { encodeKnowledgeScopeId } from '@mastra/core/knowledge';

const scope = `org:${encodeKnowledgeScopeId('auth0|a:b')}`; // 'org:auth0|a%3Ab'
```

Existing pages, pins and notes stored under a resource, thread or other scope id containing a colon keep their old address and are no longer reached; no data is rewritten.
