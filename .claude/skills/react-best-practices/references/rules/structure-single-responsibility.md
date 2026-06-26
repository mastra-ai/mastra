---
title: One Component or Hook = One Responsibility = One File
impact: MEDIUM-HIGH
impactDescription: bloated components are hard to test, review, and reuse; unrelated state changes re-render everything
tags: structure, refactoring, single-responsibility, hooks, maintainability
---

## One Component or Hook = One Responsibility = One File

Domain components and hooks must each own exactly one responsibility. If one part of a component fetches data, another filters it, another manages form state — split it. Don't fear refactoring: extracting hooks and components is cheap, while bloated components are hard to test, review, and reuse. Enforce **1 file = 1 component (or hook)**.

**Exemption:** UI/design-system components (Button, Card, layout primitives) are composition-focused and out of scope for this rule. It targets domain components.

**Incorrect (one file, one component, four responsibilities):**

```tsx
// products-page.tsx — fetching + filtering + selection + form, all entangled
function ProductsPage() {
  // Responsibility 1: data fetching
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });

  // Responsibility 2: filtering logic
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const filtered = useMemo(
    () =>
      (products ?? []).filter(
        p => p.name.includes(query) && (!category || p.category === category),
      ),
    [products, query, category],
  );

  // Responsibility 3: selection
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Responsibility 4: edit-form state for the selected product
  const selected = filtered.find(p => p.id === selectedId);
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  // ...100 more lines of form handlers, validation, submit logic

  return (/* one giant JSX tree mixing filters, list, and form */);
}
```

**Correct (each responsibility in its own file):**

```tsx
// use-product-search.ts — hook: fetching + filtering
export function useProductSearch() {
  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: fetchProducts,
  });
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Category | null>(null);
  const filtered = useMemo(
    () => (products ?? []).filter(p => p.name.includes(query) && (!category || p.category === category)),
    [products, query, category],
  );
  return { filtered, query, setQuery, category, setCategory };
}
```

```tsx
// product-list.tsx — component: render the list, report selection
export function ProductList({ products, onSelect }: ProductListProps) {
  return (
    <ul>
      {products.map(p => (
        <li key={p.id} onClick={() => onSelect(p.id)}>
          {p.name}
        </li>
      ))}
    </ul>
  );
}
```

```tsx
// product-edit-form.tsx — component: edit one product
export function ProductEditForm({ initialValues }: { initialValues: Product }) {
  const [name, setName] = useState(initialValues.name);
  const [price, setPrice] = useState(initialValues.price);
  // form handlers live here, and only here
  return (/* form JSX */);
}
```

```tsx
// products-page.tsx — component: composition only
export function ProductsPage() {
  const { filtered, query, setQuery, category, setCategory } = useProductSearch();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = filtered.find(p => p.id === selectedId);

  return (
    <>
      <ProductFilters query={query} onQueryChange={setQuery} category={category} onCategoryChange={setCategory} />
      <ProductList products={filtered} onSelect={setSelectedId} />
      {selected && <ProductEditForm key={selected.id} initialValues={selected} />}
    </>
  );
}
```

Splitting also narrows re-render scope: typing in the filter no longer re-renders the form.

Smells that trigger a split: multiple unrelated `useState`/`useQuery` clusters, comment headers separating "sections", a component you can't name without "And".

The page/container component's single responsibility is composition — wiring hooks and children together is fine.
