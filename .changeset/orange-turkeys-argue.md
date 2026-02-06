---
'@mastra/server': minor
'@mastra/client-js': patch
'@mastra/mongodb': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/pg': patch
---

Fixed agent ID generation for stored agents. Agent IDs are now automatically derived from the agent name (e.g., "My Cool Agent" becomes "my-cool-agent") instead of using random UUIDs. This makes agent IDs more readable and consistent with code-defined agents.

**Breaking change**: The `id` field is now optional when creating stored agents via the API. If not provided, it will be automatically generated from the agent name.

**Before:**

```typescript
// Client code
const agent = await client.createStoredAgent({
  id: crypto.randomUUID(), // Required, resulted in "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  name: 'My Cool Agent',
  // ... other fields
});
```

**After:**

```typescript
// Client code
const agent = await client.createStoredAgent({
  name: 'My Cool Agent',
  // ... other fields
});
// agent.id is now "my-cool-agent"

// You can still provide a custom ID if needed:
const agent = await client.createStoredAgent({
  id: 'custom-id-123',
  name: 'My Cool Agent',
  // ... other fields
});
```
