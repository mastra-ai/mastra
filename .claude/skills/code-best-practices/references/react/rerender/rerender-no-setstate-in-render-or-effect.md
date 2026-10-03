---
title: Do Not setState During Render or Effects
impact: MEDIUM-HIGH
impactDescription: avoids render loops, double renders, stale flashes, and misplaced state ownership
tags: rerender, state, useEffect, render, ownership
---

## Do Not setState During Render or Effects

Never call a state setter during the render body. It can cause render loops, extra synchronous renders, and hard-to-review control flow.

Also avoid using `useEffect` as a data-flow mechanism to push derived state after render. Effects run after paint, so the UI first renders stale or incomplete state, then renders again after the effect updates it.

Both smells usually mean state lives in the wrong component. Fix the ownership boundary: create an intermediate component that owns the state transitions, then pass direct props to children so they can compute their output during render with no synchronization step.

**Incorrect (setState during render):**

```tsx
function ProductPicker({ productId }: { productId: string }) {
  const [selectedId, setSelectedId] = useState(productId);

  if (selectedId !== productId) {
    setSelectedId(productId);
  }

  return <ProductDetails productId={selectedId} />;
}
```

**Incorrect (effect derives state from props):**

```tsx
function ProductList({ items, query }: ProductListProps) {
  const [filteredItems, setFilteredItems] = useState<Product[]>([]);

  useEffect(() => {
    setFilteredItems(filterProducts(items, query));
  }, [items, query]);

  return <Products items={filteredItems} />;
}
```

**Correct (derive during render):**

```tsx
function ProductList({ items, query }: ProductListProps) {
  const filteredItems = filterProducts(items, query);

  return <Products items={filteredItems} />;
}
```

**Correct (intermediate owner handles state transitions):**

```tsx
function ProductPage({ productId }: { productId: string }) {
  return <ProductSelectionBoundary productId={productId} />;
}

function ProductSelectionBoundary({ productId }: { productId: string }) {
  const [selectedTab, setSelectedTab] = useState<ProductTab>('overview');

  return <ProductDetails productId={productId} selectedTab={selectedTab} onSelectedTabChange={setSelectedTab} />;
}

function ProductDetails({ productId, selectedTab, onSelectedTabChange }: ProductDetailsProps) {
  const visibleSections = getVisibleSections(productId, selectedTab);

  return (
    <ProductSections sections={visibleSections} selectedTab={selectedTab} onSelectedTabChange={onSelectedTabChange} />
  );
}
```

For the narrower case where local state must reset when an upstream identity changes, prefer remounting the stateful branch through hierarchy or `key`; see `rerender-no-useeffect-state-reset`.

## Review Smells

- Any `setX(...)` call directly in the component body.
- `useEffect(() => setX(...), [...])` where `x` can be computed from props or state during render.
- State whose only purpose is to mirror props.
- A child receiving stale props for one render and being corrected by an effect.
- Effects used to coordinate ownership between parent and child components.
