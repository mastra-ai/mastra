---
title: Branch the Body, Keep One Wrapper
impact: MEDIUM
impactDescription: a ternary tree buries the layout, and duplicating the wrapper in every early return is its own smell that drifts as branches change
tags: structure, readability, rendering, control-flow, maintainability
---

## Branch the Body, Keep One Wrapper

When a component renders mutually exclusive top-level states — loading, empty, error, or a mode switch — pick the view with guard clauses (early returns), but keep the layout wrapper in ONE place. Don't ternary the whole returned JSX, and don't paste the wrapper into every branch either. Wrap a small body component that returns the bare content for each state.

**Incorrect (a ternary tree inside the wrapper):**

```tsx
return <Panel>{isLoading ? <Skeleton /> : isDetailOpen ? <Detail /> : <List items={items} />}</Panel>;
```

**Also incorrect (the wrapper duplicated in every early return):**

```tsx
if (isLoading)
  return (
    <Panel>
      <Skeleton />
    </Panel>
  );
if (isDetailOpen)
  return (
    <Panel>
      <Detail />
    </Panel>
  );
return (
  <Panel>
    <List items={items} />
  </Panel>
);
```

**Also incorrect (passing query state down for the child to sort out):**

```tsx
function ThingPanel({ itemId, isDetailOpen }: ThingPanelProps) {
  const query = useItems(itemId);

  return (
    <Panel>
      <PanelBody {...query} isDetailOpen={isDetailOpen} />
    </Panel>
  );
}
```

**Correct (one wrapper; the body owns the query source and branches from it):**

```tsx
function PanelBody({ itemId, isDetailOpen }: { itemId: string; isDetailOpen: boolean }) {
  const { data: items, isLoading, error } = useItems(itemId);

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState error={error} />;
  if (isDetailOpen) return <Detail items={items} />;
  return <List items={items} />;
}

function ThingPanel({ itemId, isDetailOpen }: ThingPanelProps) {
  return (
    <Panel>
      <PanelBody itemId={itemId} isDetailOpen={isDetailOpen} />
    </Panel>
  );
}
```

Prefer colocating the query with the branch that renders its result. The component that calls `useQuery` or a data hook owns that hook's `isLoading` and `error` states; do not spread query props into a child just so the child can rediscover loading/error responsibility.

If a parent must call the query because multiple sibling regions share the data, that parent is the data owner. It should branch on `isLoading` and `error` before rendering ready children, then pass those children only the data and view flags they can render.

Hooks must run before the first branch, so if the body component owns the query hook, it handles its own loading/error guards above the ready branch. Lifting the wrapper to the parent is the same idea — wherever it lives, it appears once.

This applies only to **mutually exclusive** views. When regions coexist in the layout — `<Panel><Detail /><List /></Panel>` — do not hoist one skeleton over both; let each child own its loading state (a skeleton colocated inside `<Detail />` / `<List />`). A top-level early return there would wrongly hide siblings.

Smell: the component's `return` is `a ? <X/> : b ? <Y/> : <Z/>`, or the same layout shell (`<Panel>`, `<Card>`, `<Layout>`) is repeated across several `return`s. Lift the shell out and branch the body.
