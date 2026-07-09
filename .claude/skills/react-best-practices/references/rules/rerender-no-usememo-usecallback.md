---
title: Do Not Add useMemo or useCallback
impact: MEDIUM
impactDescription: avoids agent-owned memoization decisions, dependency bugs, and stale closures
tags: rerender, useMemo, useCallback, memoization, closures
---

## Do Not Add useMemo or useCallback

Agents must not introduce `useMemo` or `useCallback`. Memoization is an optimization decision that belongs to the developer with profiler evidence and workload context. It has real costs: dependency-array bugs, stale closures, more complex reviews, and readability loss. The payoff is workload-dependent, so code generation should not guess.

**Incorrect (memoization added by default):**

```tsx
function ProductList({ products, query }: ProductListProps) {
  const visibleProducts = useMemo(
    () => products.filter(product => product.name.includes(query)),
    [products, query],
  );

  const handleSelect = useCallback((product: Product) => {
    trackSelection(product.id);
  }, []);

  return <Products products={visibleProducts} onSelect={handleSelect} />;
}
```

**Correct (derive directly during render):**

```tsx
function ProductList({ products, query }: ProductListProps) {
  const visibleProducts = products.filter(product => product.name.includes(query));

  function handleSelect(product: Product) {
    trackSelection(product.id);
  }

  return <Products products={visibleProducts} onSelect={handleSelect} />;
}
```

If a function is only needed from an effect, use `useEffectEvent` rather than `useCallback`; see `rerender-useeffect-function-calls`.

```tsx
function ProductTracker({ product }: { product: Product }) {
  const trackView = useEffectEvent(() => {
    analytics.track('product_viewed', { id: product.id });
  });

  useEffect(() => {
    trackView();
  }, [product.id]);
}
```

If initialization is genuinely expensive and only needed once per mount, use lazy `useState`; see `rerender-lazy-state-init`.

```tsx
const [initialIndex] = useState(() => findInitialIndex(items));
```

If a subtree re-renders too much, restructure ownership and composition instead of masking it with memoization. Put state closer to where it changes, split unrelated responsibilities, and pass stable domain values rather than broad parent-owned objects.

## Review Smells

- New imports of `useMemo` or `useCallback`.
- Memoization added because a linter or agent expected stable identities.
- Dependency arrays that duplicate the body of a derived calculation.
- `useCallback` used only to satisfy a `useEffect` dependency; prefer `useEffectEvent`.
- Memoization used to compensate for a component owning too much unrelated state.
