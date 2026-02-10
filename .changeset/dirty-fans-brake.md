---
'@mastra/client-js': patch
---

Fixed multiple issues with stored agents:

1. **Memory field can now be disabled**: Fixed an issue where the memory field couldn't be set to `null` to disable memory on stored agents. The update endpoint now accepts `memory: null` to explicitly disable memory configuration.

2. **Agent-level scorers are now discoverable**: Fixed an issue where scorers attached to code-defined agents (e.g., answer relevancy scorer) were not available in the scorer dropdown for stored agents. The system now automatically registers agent-level scorers with the Mastra instance, making them discoverable through `resolveStoredScorers`.

3. **Agent IDs are now derived from names**: Agent IDs are now automatically generated from the agent name using slugification (e.g., "My Cool Agent" becomes "my-cool-agent") instead of using random UUIDs. This makes agent IDs more readable and consistent with code-defined agents.

**Before:**

```typescript
// Creating an agent required a manual ID
const agent = await client.createStoredAgent({
  id: crypto.randomUUID(), // Required, resulted in "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
  name: 'My Cool Agent',
  // ...
});

// Couldn't disable memory
await client.updateStoredAgent(agentId, {
  memory: null, // ❌ Would throw validation error
});

// Agent-level scorers weren't available for stored agents
// e.g., answer-relevancy-scorer from evalAgent wasn't in the dropdown
```

**After:**

```typescript
// ID is auto-generated from name
const agent = await client.createStoredAgent({
  name: 'My Cool Agent',
  // ...
});
// agent.id is now "my-cool-agent"

// Can disable memory
await client.updateStoredAgent(agentId, {
  memory: null, // ✅ Works, disables memory
});

// All agent-level scorers are now available in the dropdown
```
