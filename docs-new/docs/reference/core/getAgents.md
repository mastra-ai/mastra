---
title: 'Reference: Mastra.getAgents() '
description: 'Documentation for the `Mastra.getAgents()` method in Mastra, which retrieves all configured agents.'
---

# Mastra.getAgents()

The `.getAgents()` method is used to retrieve all agents that have been configured in the Mastra instance.

## Usage example

```typescript copy
mastra.getAgents();
```

## Parameters

This method does not accept any parameters.

## Returns

<PropertiesTable
content={[
{
name: "agents",
type: "TAgents",
description: "A record of all configured agents, where keys are agent names and values are agent instances.",
},
]}
/>

## Related

- [Agents overview](../../docs/agents/overview)
- [Dynamic agents](../../docs/agents/dynamic-agents)
