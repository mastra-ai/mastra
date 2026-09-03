# Nodes and records

A node is the durable entity in the Knowledge graph. A record is append-only evidence owned by a node. Node memberships and record memberships are intentionally separate.

## Write through Knowledge

Use public `Knowledge` operations rather than its storage internals. Supply host-vouched scopes and the current numeric version for mutations.

```ts
const node = await knowledge.createNode({
  name: 'Refund policy',
  scopeIds,
  vouchedScopeIds,
});

const record = await knowledge.createRecord({
  node,
  text: 'Refunds are available within 30 days.',
  scopeIds,
  vouchedScopeIds,
});
```

Inspect the installed `@mastra/core/knowledge` types for exact input signatures. APIs distinguish caller authority scopes from the memberships assigned to new or updated data.

## Read and search safely

Keep every query bounded and continue only with returned opaque cursors. Exact-name lookup is distinct from prefix search. Search and mention queries authorize candidates before applying rank, counts, limits, or cursor shaping.

```ts
const page = await knowledge.listNodes({ scopeIds, limit: 50 });
```

Don't infer hidden matches from missing list entries, score gaps, degree changes, boundary edges, or pagination behavior. Hydrate semantic-search results through authorized Knowledge reads instead of trusting vector metadata.

## Versions and deletion

Node and record versions are monotonic compare-and-swap tokens. Soft deletion is reversible when the caller retains authority; permanent deletion cleans memberships, addresses, mentions, and semantic lifecycle state. A merge moves source-owned records, including deleted records, to the target and preserves address continuity.

The semantic outbox serializes upsert and delete operations by document version. Consumers must respect predecessor ordering, stale-claim recovery, and apply-time authorization. Never index unsanitized hidden scope IDs, names, or text.

## Mentions

Wikilinks resolve to uniquely visible targets inside the session-clamped scope frontier. They don't create scope membership. If a target is inaccessible, omit the relationship entirely. When names are ambiguous, leave the mention unresolved rather than choosing arbitrarily.
