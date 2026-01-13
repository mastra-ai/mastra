---
"@mastra/core": minor
"@mastra/server": minor
"@mastra/pg": minor
"@mastra/libsql": minor
"@mastra/mongodb": minor
"@mastra/client-js": minor
---

Add source field to agents and ownerId for multi-tenant filtering

- Add `source` field to Agent class to distinguish code-defined (`'code'`) vs stored (`'stored'`) agents
- Add `ownerId` field to stored agents for multi-tenant filtering
- Add `ownerId` and `metadata` filtering to `listAgents` API
- Add schema migration to automatically add `ownerId` column to existing agents tables

## Usage

### Check agent source
```typescript
const agent = await mastra.getAgent('my-agent');
if (agent.source === 'stored') {
  // Agent was created via the Studio UI
} else {
  // Agent was defined in code
}
```

### Filter stored agents by ownerId
```typescript
// Create stored agent with ownerId
await client.createStoredAgent({
  id: 'support-agent',
  name: 'Support Agent',
  // ...other config
  ownerId: 'user-123',
});

// List agents for a specific owner
const { agents } = await client.listStoredAgents({
  ownerId: 'user-123',
});
```

### Filter by metadata
```typescript
const { agents } = await client.listStoredAgents({
  metadata: { team: 'engineering', environment: 'production' },
});
```
