---
title: Early-Return Render Branches, Don't Ternary the Wrapper
impact: MEDIUM
impactDescription: a loading/empty/mode ternary wrapped around the whole returned JSX buries the real layout and grows unreadable as branches are added
tags: structure, readability, rendering, control-flow, maintainability
---

## Early-Return Render Branches, Don't Ternary the Wrapper

When a component renders distinct top-level states — loading, empty, error, or a mode switch — return each from its own `if` guard instead of nesting ternaries inside the returned JSX. Early returns keep each branch readable on its own and let the main `return` show the real layout without indentation creep.

**Incorrect (the wrapper is a ternary tree):**

```tsx
return (
  <Panel>
    {isLoading ? (
      <Skeleton />
    ) : isDetailOpen ? (
      <Detail />
    ) : (
      <List items={items} />
    )}
  </Panel>
);
```

**Correct (one early return per state):**

```tsx
if (isLoading) {
  return (
    <Panel>
      <Skeleton />
    </Panel>
  );
}

if (isDetailOpen) {
  return (
    <Panel>
      <Detail />
    </Panel>
  );
}

return (
  <Panel>
    <List items={items} />
  </Panel>
);
```

All hooks must still run before the first early return — keep `useState`/`useEffect`/data hooks at the top, then branch. Pair this with deriving the branch flags from hooks rather than props (see [`structure-derive-dont-duplicate`](./structure-derive-dont-duplicate.md)); a single flat ternary for a leaf value is fine, but a ternary nested inside another is its own smell (see [`structure-no-nested-ternary`](./structure-no-nested-ternary.md)).

Smell: the component's `return` is `a ? <X/> : b ? <Y/> : <Z/>` over loading/empty/mode flags. Lift each into an `if (...) return ...`.
