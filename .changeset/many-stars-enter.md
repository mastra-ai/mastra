---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/editor': minor
'@mastra/playground-ui': minor
'@mastra/client-js': minor
---

Added observational memory configuration support for stored agents. When creating or editing a stored agent in the playground, you can now enable observational memory and configure its settings including model provider/name, scope (thread or resource), share token budget, and detailed observer/reflector parameters like token limits, buffer settings, and blocking thresholds. The configuration is serialized as part of the agent's memory config and round-trips through storage.

**Example usage in the playground:**

Enable the Observational Memory toggle in the Memory section, then configure:

- Top-level model (provider + model) used by both observer and reflector
- Scope: `thread` (per-conversation) or `resource` (shared across threads)
- Expand **Observer** or **Reflector** sections to override models and tune token budgets

**Programmatic usage via client SDK:**

```ts
await client.createStoredAgent({
  name: 'My Agent',
  // ...other config
  memory: {
    observationalMemory: true, // enable with defaults
    options: { lastMessages: 40 },
  },
});

// Or with custom configuration:
await client.createStoredAgent({
  name: 'My Agent',
  memory: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      scope: 'resource',
      shareTokenBudget: true,
      observation: { messageTokens: 50000 },
      reflection: { observationTokens: 60000 },
    },
    options: { lastMessages: 40 },
  },
});
```

**Programmatic usage via editor:**

```ts
await editor.agent.create({
  name: 'My Agent',
  // ...other config
  memory: {
    observationalMemory: true, // enable with defaults
    options: { lastMessages: 40 },
  },
});

// Or with custom configuration:
await editor.agent.create({
  name: 'My Agent',
  memory: {
    observationalMemory: {
      model: 'google/gemini-2.5-flash',
      scope: 'resource',
      shareTokenBudget: true,
      observation: { messageTokens: 50000 },
      reflection: { observationTokens: 60000 },
    },
    options: { lastMessages: 40 },
  },
});
```
