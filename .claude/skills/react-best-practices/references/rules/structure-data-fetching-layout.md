---
title: Data-Fetching Domain Components Render Through a Layout Component
impact: MEDIUM-HIGH
impactDescription: keeps the page shell stable across loading and ready states, prevents layout shift, and stops loading/ready markup from drifting apart
tags: structure, data-fetching, layout, skeleton, loading, composition
---

## Data-Fetching Domain Components Render Through a Layout Component

When a domain component needs to fetch data, split it in two:

1. A **layout component** — pure, no data, no hooks. It only positions named slots (`header`, `sidebar`, `content`, …) at the right place in the DOM.
2. The **domain component** — it owns the query, and fills each slot by branching: a skeleton while loading, or the resolved sub-domain component once data is available.

The layout is rendered once and is shared by the loading and ready states, so the skeleton has the exact same structure as the final UI and the shell never jumps.

**Incorrect (layout duplicated between loading and ready states):**

```tsx
function AgentOverview({ agentId }: { agentId: string }) {
  const { data: agent, isLoading } = useAgent(agentId);

  if (isLoading) {
    return (
      <div className="grid grid-cols-[1fr_320px] gap-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_300px] gap-6">
      <AgentHeader agent={agent} />
      <AgentTools tools={agent.tools} />
    </div>
  );
}
```

The two grids already disagree (`320px`/`gap-4` vs `300px`/`gap-6`): the page shifts when data arrives, and every layout change must be made twice.

**Also incorrect (layout mixed with fetching and branching):**

```tsx
function AgentOverview({ agentId }: { agentId: string }) {
  const { data: agent, isLoading } = useAgent(agentId);

  return (
    <div className="grid grid-cols-[1fr_300px] gap-6">
      {isLoading ? <Skeleton className="h-10" /> : <AgentHeader agent={agent} />}
      <aside className="sticky top-0">
        {isLoading ? <Skeleton className="h-64" /> : <AgentTools tools={agent.tools} />}
      </aside>
    </div>
  );
}
```

Positioning, fetching, and state branching all live in one component; the layout cannot be reused or read on its own.

**Correct (layout positions slots; the domain component branches what goes in them):**

```tsx
// agent-overview-layout.tsx — pure positioning, no data
interface AgentOverviewLayoutProps {
  header: ReactNode;
  tools: ReactNode;
}

function AgentOverviewLayout({ header, tools }: AgentOverviewLayoutProps) {
  return (
    <div className="grid grid-cols-[1fr_300px] gap-6">
      {header}
      <aside className="sticky top-0">{tools}</aside>
    </div>
  );
}
```

```tsx
// agent-overview.tsx — owns the data, picks skeleton OR resolved sub-domain components
function AgentOverview({ agentId }: { agentId: string }) {
  const { data: agent, isLoading, error } = useAgent(agentId);

  if (error) return <ErrorState error={error} />;

  if (isLoading || !agent) {
    return <AgentOverviewLayout header={<AgentHeaderSkeleton />} tools={<AgentToolsSkeleton />} />;
  }

  return <AgentOverviewLayout header={<AgentHeader agent={agent} />} tools={<AgentTools tools={agent.tools} />} />;
}
```

### Guidelines

- **Layout components are dumb.** Slot props are `ReactNode`; no hooks, no data types, no `isLoading` prop. If the layout needs to know about loading, the branching is in the wrong place.
- **Branch per state, not per slot.** Use early returns (see `structure-early-return-render-branches`) to pick a whole set of slot contents; avoid an `isLoading ? … : …` ternary in every slot.
- **Sub-domain components receive resolved data.** `AgentHeader` takes `agent`, not `agent | undefined` — absence is handled by the parent's branch (see `types-no-null`, `structure-derive-dont-duplicate`).
- **Each sub-domain component has a matching skeleton** with the same footprint, so the slot keeps its size across states.
- **Independent data per slot:** if slots fetch independently, let each sub-domain component own its own query and skeleton inside its slot instead of hoisting one loading state over the whole layout. The layout component is still used to position them.
- Error and empty states may replace the layout entirely or fill a slot — pick one per screen and stay consistent.

Smell: a data-fetching component that contains both positioning markup (`grid`, `flex`, `sticky`, column widths) and `isLoading` checks, or the same wrapper markup written once for the skeleton and once for the ready UI. Extract a `<XLayout>` with slot props and branch the slot contents instead.
