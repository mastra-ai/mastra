# Access and scopes

Knowledge authorization consumes a set of scope-node UUIDs vouched for by the host. It doesn't consume user identity directly.

## Resolve authority at the boundary

Authenticate the request in your application, map it to live scope nodes, then pass those IDs to Knowledge. Sort and deduplicate the set. Never accept an arbitrary client-provided scope set.

```ts
const scopeIds = await resolveVouchedKnowledgeScopes(session);
const result = await knowledge.listNodes({ scopeIds, limit: 50 });
```

Scopes are graph nodes with `isScope: true`. Node membership uses `nodeId -> scopeNodeId` edges; record membership is separate. An address resolves a scope UUID, but the address string doesn't confer authority and its separators don't imply nesting.

## Roles

From least to most capable:

- `readonly`: read visible content.
- `suggest`: submit proposals without direct mutation.
- `append`: add content without rewriting existing content.
- `edit`: update content.
- `owner`: manage access and structure.

For each vouched scope, authorization follows scope memberships toward the target. The nearest grant declaration stops that branch. Multiple branches combine at the greatest role. Traversal uses a visited set, so cycles are safe.

## Privacy rules

Authorization must run before search, ranking, counts, limits, pagination, cursor generation, backlinks, degree calculation, graph shaping, or deep-link resolution. An inaccessible resource must look absent, normally as a 404 at an HTTP boundary.

Wikilinks are content, not access edges. A link to a hidden node grants no membership and produces no dangling hint. Resource and thread scopes remain valid authority; don't collapse all requests to an organization scope.

## Mutations

Mutations use numeric versions for compare-and-swap and can also be fenced by the current access epoch. On a conflict, reread through the same authorized API and retry intentionally. Don't bypass governed `Knowledge` methods with raw storage access.

Curator profiles are also host-bound. The host registers the profile and identity scope. Content scopes describe mutation targets; they never vouch for the curator's principal authority.
