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

**Correct (one wrapper; the body early-returns bare content):**

```tsx
function PanelBody(props) {
  if (isLoading) return <Skeleton />;
  if (isDetailOpen) return <Detail />;
  return <List items={items} />;
}

function ThingPanel(props) {
  return (
    <Panel>
      <PanelBody {...props} />
    </Panel>
  );
}
```

Hooks must run before the first early return, so they live in the body component, above the guards. Lifting the wrapper to the parent is the same idea — wherever it lives, it appears once.

This applies only to **mutually exclusive** views. When regions coexist in the layout — `<Panel><Detail /><List /></Panel>` — do not hoist one skeleton over both; let each child own its loading state (a skeleton colocated inside `<Detail />` / `<List />`). A top-level early return there would wrongly hide siblings.

Smell: the component's `return` is `a ? <X/> : b ? <Y/> : <Z/>`, or the same layout shell (`<Panel>`, `<Card>`, `<Layout>`) is repeated across several `return`s. Lift the shell out and branch the body.
