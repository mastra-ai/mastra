---
title: Compose Components, Don't Map Config Objects
impact: MEDIUM
impactDescription: a config array invents an intermediate shape every reader must decode, hides which data each item depends on, and drifts as items diverge
tags: structure, composition, readability, data-fetching, maintainability
---

## Compose Components, Don't Map Config Objects

When a component renders a known, fixed set of items, write one component per item and compose them with explicit JSX props. Don't build an array of config objects and `.map` it onto a presentational component — that invents a shape which gets remapped onto props, two translations for zero gain. A config array is only justified when the list is dynamic (driven by data, not code); a fixed set of features, capabilities, or tabs is code: declare each one.

**Incorrect (config array remapped onto a component shape):**

```tsx
function CapabilitiesPanel({ agentId }: { agentId: string }) {
  const { data: memory, isLoading: isMemoryLoading } = useMemory(agentId);
  const { data: agent, isLoading: isAgentLoading } = useAgent(agentId);

  const capabilities: Capability[] = [
    { id: 'memory', label: 'Memory', status: getMemoryStatus(isMemoryLoading, memory) /* ... */ },
    { id: 'tools', label: 'Tools', status: getToolsStatus(isAgentLoading, agent) /* ... */ },
    // every new capability grows this array and its helper zoo
  ];

  return capabilities.map(capability => <CapabilityRow key={capability.id} capability={capability} />);
}
```

The parent hoists every query and threads `isLoading` flags into per-item status helpers — pseudo-render logic living outside any component.

**Correct (one component per item; each owns its data and loading):**

```tsx
function MemoryCapability({ agentId }: { agentId: string }) {
  const { data: memory, isLoading } = useMemory(agentId);
  const enabled = Boolean(memory?.result);

  return <CapabilityRow label="Memory" status={isLoading ? 'Checking' : enabled ? 'On' : 'Off'} enabled={enabled} />;
}

function ToolsCapability({ agentId }: { agentId: string }) {
  const { data: agent, isLoading } = useAgent(agentId);
  const count = Object.keys(agent?.tools ?? {}).length;

  return <CapabilityRow label="Tools" status={isLoading ? 'Checking' : String(count)} enabled={count > 0} />;
}

function CapabilitiesPanel({ agentId }: { agentId: string }) {
  return (
    <>
      <MemoryCapability agentId={agentId} />
      <ToolsCapability agentId={agentId} />
    </>
  );
}
```

TanStack Query dedupes the requests across instances (`client-request-dedupe`), so per-component ownership costs no extra network, and status derivation lives inside the component that owns the query (`structure-early-return-render-branches`). If an aggregate over the set is needed (a count, a summary), derive it in a sibling component from the same deduped queries via small shared pure functions — don't resurrect the config array for it.

Smell: a `const items: SomeShape[] = [...]` literal followed by `items.map(item => <Row {...item} />)`; status helpers taking `isLoading`/`enabled` flags as parameters; adding a feature means editing an array instead of adding a component.
