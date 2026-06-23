---
'@mastra/core': patch
---

Added stable session `id` and `ownerId` to Harness sessions. `SessionIdentity` now exposes `getId()` and `getOwnerId()`, and `harness.createSession()` accepts optional `id` and `ownerId` to set them. These identifiers are stable for the life of the session — they do not change when the resource ID is switched — and are surfaced in the harness request context session snapshot.

The `Session` and `SessionIdentity` constructors now require `id` and `ownerId`. If you construct sessions directly, pass both values:

```typescript
// Before
const session = new Session({ resourceId: 'my-resource' });

// After
const session = new Session({
  resourceId: 'my-resource',
  id: 'my-session-id',
  ownerId: 'my-owner-id',
});
```

For callers that go through `harness.createSession()`, no changes are needed — `id` defaults to the effective resource ID and `ownerId` defaults to the harness `config.id`:

```typescript
const session = await harness.createSession({
  id: 'my-session-id',
  ownerId: 'my-owner-id',
});

session.identity.getId(); // 'my-session-id'
session.identity.getOwnerId(); // 'my-owner-id'
```
