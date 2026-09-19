---
title: Never Reset State with useEffect — Remount via Component Hierarchy
impact: MEDIUM-HIGH
impactDescription: extra render cycles, stale-state flashes, and sync bugs
tags: rerender, useEffect, state, remount, forms
---

## Never Reset State with useEffect — Remount via Component Hierarchy

Never use `useEffect` to reset or re-sync local state when an upstream identity changes (e.g., a form's initial values when the selected product changes). Instead, restructure the component hierarchy: lift the discriminant (the product id) to the top of the tree, fetch the new entity there, and render a skeleton while loading. The skeleton unmounts the branch containing the form, so when the data arrives the form remounts and its `useState` initializers naturally pick up the fresh `initialValues`.

**Incorrect (useEffect syncs state when product changes):**

```tsx
function ProductForm({ product }: { product: Product }) {
  const [name, setName] = useState(product.name);
  const [price, setPrice] = useState(product.price);

  // Anti-pattern: re-syncing state with an effect.
  // Renders once with stale values, then again after the effect runs.
  // Every new field must be added here too — easy to forget, causes drift.
  useEffect(() => {
    setName(product.name);
    setPrice(product.price);
  }, [product.id]);

  return (
    <form>
      <input value={name} onChange={e => setName(e.target.value)} />
      <input value={price} onChange={e => setPrice(e.target.value)} />
    </form>
  );
}
```

**Correct (lift the discriminant; skeleton unmounts the branch, form remounts fresh):**

```tsx
// Top of the tree: the product id is the discriminant
function ProductPage({ productId }: { productId: string }) {
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', productId],
    queryFn: () => fetchProduct(productId),
  });

  // While the new product loads, the skeleton replaces the form branch.
  // The old ProductForm unmounts, so its state is discarded.
  if (isLoading) return <ProductFormSkeleton />;

  // Fresh mount: useState initializers run again with the new values.
  return <ProductForm initialValues={product} />;
}

function ProductForm({ initialValues }: { initialValues: Product }) {
  // Initialized once per mount — no sync effect needed, ever.
  const [name, setName] = useState(initialValues.name);
  const [price, setPrice] = useState(initialValues.price);

  return (
    <form>
      <input value={name} onChange={e => setName(e.target.value)} />
      <input value={price} onChange={e => setPrice(e.target.value)} />
    </form>
  );
}
```

**Fallback when data is already local (no fetch boundary):**

```tsx
// key forces a remount when the product changes
<ProductForm key={product.id} initialValues={product} />
```

Prefer the hierarchy restructure (fetch high + skeleton) over `key`: it also removes the stale-data problem because the form can never render with the previous product's values. Use `key` as the minimal fix when no async boundary exists.
