# React Best Practices

**Version 0.2.0**
Mastra Engineering
January 2026

> **Note:**
> This document is mainly for agents and LLMs to follow when maintaining,
> generating, or refactoring React codebases. Humans
> may also find it useful, but guidance here is optimized for automation
> and consistency by AI-assisted workflows.

---

## Abstract

Performance optimization guide for React applications, designed for AI agents and LLMs. Contains 15 rules across 7 categories, prioritized by impact from critical (eliminating waterfalls, reducing bundle size) to incremental (JavaScript micro-optimizations). Each rule includes detailed explanations, real-world examples comparing incorrect vs. correct implementations, and specific impact metrics to guide automated refactoring and code generation.

---

## Table of Contents

1. [Eliminating Waterfalls](#1-eliminating-waterfalls) — **CRITICAL**
   - 1.1 [Promise.all() for Independent Operations](#11-promiseall-for-independent-operations)
2. [Bundle Size Optimization](#2-bundle-size-optimization) — **CRITICAL**
   - 2.1 [Avoid Barrel File Imports](#21-avoid-barrel-file-imports)
   - 2.2 [Defer Non-Critical Third-Party Libraries](#22-defer-non-critical-third-party-libraries)
3. [Client-Side Data Fetching](#3-client-side-data-fetching) — **MEDIUM-HIGH**
   - 3.1 [Use TanStack Query for Automatic Deduplication](#31-use-tanstack-query-for-automatic-deduplication)
4. [Re-render Optimization](#4-re-render-optimization) — **MEDIUM**
   - 4.1 [Use Lazy State Initialization](#41-use-lazy-state-initialization)
   - 4.2 [Use Transitions for Non-Urgent Updates](#42-use-transitions-for-non-urgent-updates)
   - 4.3 [useEffectEvent for Functions in useEffect](#43-useeffectevent-for-functions-in-useeffect)
   - 4.4 [Never Reset State with useEffect](#44-never-reset-state-with-useeffect)
5. [Rendering Performance](#5-rendering-performance) — **MEDIUM**
   - 5.1 [Animate SVG Wrapper Instead of SVG Element](#51-animate-svg-wrapper-instead-of-svg-element)
   - 5.2 [CSS content-visibility for Long Lists](#52-css-content-visibility-for-long-lists)
6. [JavaScript Performance](#6-javascript-performance) — **LOW-MEDIUM**
   - 6.1 [Early Length Check for Array Comparisons](#61-early-length-check-for-array-comparisons)
   - 6.2 [Use Set/Map for O(1) Lookups](#62-use-setmap-for-o1-lookups)
   - 6.3 [Use toSorted() Instead of sort() for Immutability](#63-use-tosorted-instead-of-sort-for-immutability)
7. [Component Structure](#7-component-structure) — **MEDIUM-HIGH**
   - 7.1 [One Component or Hook = One Responsibility = One File](#71-one-component-or-hook--one-responsibility--one-file)
   - 7.2 [JSX-Returning Helpers Must Be Components](#72-jsx-returning-helpers-must-be-components)
8. [Testing](#8-testing) — **MEDIUM-HIGH**
   - 8.1 [BDD Tests That Mock Only the Network](#81-bdd-tests-that-mock-only-the-network)

---

## 1. Eliminating Waterfalls

**Impact: CRITICAL**

Waterfalls are the #1 performance killer. Each sequential await adds full network latency. Eliminating them yields the largest gains.

### 1.1 Promise.all() for Independent Operations

When async operations have no interdependencies, execute them concurrently using `Promise.all()`.

**Incorrect (sequential execution, 3 round trips):**

```typescript
const user = await fetchUser();
const posts = await fetchPosts();
const comments = await fetchComments();
```

**Correct (parallel execution, 1 round trip):**

```typescript
const [user, posts, comments] = await Promise.all([fetchUser(), fetchPosts(), fetchComments()]);
```

---

## 2. Bundle Size Optimization

**Impact: CRITICAL**

Reducing initial bundle size improves Time to Interactive and Largest Contentful Paint.

### 2.1 Avoid Barrel File Imports

Import directly from source files instead of barrel files to avoid loading thousands of unused modules. **Barrel files** are entry points that re-export multiple modules (e.g., `index.js` that does `export * from './module'`).

Popular icon and component libraries can have **up to 10,000 re-exports** in their entry file. For many React packages, **it takes 200-800ms just to import them**, affecting both development speed and production cold starts.

**Why tree-shaking doesn't help:** When a library is marked as external (not bundled), the bundler can't optimize it. If you bundle it to enable tree-shaking, builds become substantially slower analyzing the entire module graph.

**Incorrect (imports entire library):**

```tsx
import { Check, X, Menu } from 'lucide-react';
// Loads 1,583 modules, takes ~2.8s extra in dev
// Runtime cost: 200-800ms on every cold start

import { Button, TextField } from '@mui/material';
// Loads 2,225 modules, takes ~4.2s extra in dev
```

**Correct (imports only what you need):**

```tsx
import Check from 'lucide-react/dist/esm/icons/check';
import X from 'lucide-react/dist/esm/icons/x';
import Menu from 'lucide-react/dist/esm/icons/menu';
// Loads only 3 modules (~2KB vs ~1MB)

import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
// Loads only what you use
```

### 2.2 Defer Non-Critical Third-Party Libraries

Analytics, logging, and error tracking don't block user interaction. Load them after hydration.

**Incorrect (blocks initial bundle):**

```tsx
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

**Correct (loads after hydration):**

```tsx
import { lazy, Suspense } from 'react';

const Analytics = lazy(() => import('@vercel/analytics/react').then(m => ({ default: m.Analytics })));

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Suspense fallback={null}>
          <Analytics />
        </Suspense>
      </body>
    </html>
  );
}
```

---

## 3. Client-Side Data Fetching

**Impact: MEDIUM-HIGH**

Automatic deduplication and efficient data fetching patterns reduce redundant network requests.

### 3.1 Use TanStack Query for Automatic Deduplication

TanStack Query enables request deduplication, caching, and revalidation across component instances.

**Incorrect (no deduplication, each instance fetches):**

```tsx
function UserList() {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch('/api/users')
      .then(r => r.json())
      .then(setUsers);
  }, []);
}
```

**Correct (multiple instances share one request):**

```tsx
import { useQuery } from '@tanstack/react-query';

function UserList() {
  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
  });
}
```

**For immutable data:**

```tsx
import { useQuery } from '@tanstack/react-query';

function StaticContent() {
  const { data } = useQuery({
    queryKey: ['config'],
    queryFn: () => fetch('/api/config').then(r => r.json()),
    staleTime: Infinity,
  });
}
```

**For mutations:**

```tsx
import { useMutation } from '@tanstack/react-query';

function UpdateButton() {
  const { mutate } = useMutation({
    mutationFn: updateUser,
  });
  return <button onClick={() => mutate()}>Update</button>;
}
```

Reference: [https://tanstack.com/query](https://tanstack.com/query)

---

## 4. Re-render Optimization

**Impact: MEDIUM**

Reducing unnecessary re-renders minimizes wasted computation and improves UI responsiveness.

### 4.1 Use Lazy State Initialization

Pass a function to `useState` for expensive initial values. Without the function form, the initializer runs on every render even though the value is only used once.

**Incorrect (runs on every render):**

```tsx
function FilteredList({ items }: { items: Item[] }) {
  // buildSearchIndex() runs on EVERY render, even after initialization
  const [searchIndex, setSearchIndex] = useState(buildSearchIndex(items));
  const [query, setQuery] = useState('');

  // When query changes, buildSearchIndex runs again unnecessarily
  return <SearchResults index={searchIndex} query={query} />;
}

function UserProfile() {
  // JSON.parse runs on every render
  const [settings, setSettings] = useState(JSON.parse(localStorage.getItem('settings') || '{}'));

  return <SettingsForm settings={settings} onChange={setSettings} />;
}
```

**Correct (runs only once):**

```tsx
function FilteredList({ items }: { items: Item[] }) {
  // buildSearchIndex() runs ONLY on initial render
  const [searchIndex, setSearchIndex] = useState(() => buildSearchIndex(items));
  const [query, setQuery] = useState('');

  return <SearchResults index={searchIndex} query={query} />;
}

function UserProfile() {
  // JSON.parse runs only on initial render
  const [settings, setSettings] = useState(() => {
    const stored = localStorage.getItem('settings');
    return stored ? JSON.parse(stored) : {};
  });

  return <SettingsForm settings={settings} onChange={setSettings} />;
}
```

Use lazy initialization when computing initial values from localStorage/sessionStorage, building data structures (indexes, maps), reading from the DOM, or performing heavy transformations.

For simple primitives (`useState(0)`), direct references (`useState(props.value)`), or cheap literals (`useState({})`), the function form is unnecessary.

### 4.2 Use Transitions for Non-Urgent Updates

Mark frequent, non-urgent state updates as transitions to maintain UI responsiveness.

**Incorrect (blocks UI on every scroll):**

```tsx
function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handler = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
}
```

**Correct (non-blocking updates):**

```tsx
import { startTransition } from 'react';

function ScrollTracker() {
  const [scrollY, setScrollY] = useState(0);
  useEffect(() => {
    const handler = () => {
      startTransition(() => setScrollY(window.scrollY));
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);
}
```

### 4.3 useEffectEvent for Functions in useEffect

Using `useCallback` for event handlers adds unnecessary complexity and dependency array management. React 19's `useEffectEvent` provides a cleaner solution that automatically captures the latest values without requiring dependency tracking.

**Incorrect (unnecessary memoization with dependency management):**

```tsx
import { useCallback } from 'react';

export function App() {
  // useCallback adds boilerplate and requires managing dependencies
  const onSubmit = useCallback((data: FormData) => {
    // handle submission
  }, []);

  return <Form onSubmit={onSubmit} />;
}
```

**Correct (useEffectEvent for event handlers):**

```tsx
import { useEffectEvent } from 'react';

export function App() {
  // useEffectEvent always sees latest values, no dependency array needed
  const onSubmit = useEffectEvent((data: FormData) => {
    // handle submission
  });

  return <Form onSubmit={onSubmit} />;
}
```

Reserve `useCallback` and `useMemo` for expensive computations (e.g., processing 200+ entries) where memoization provides measurable performance benefits. For typical event handlers, `useEffectEvent` is the preferred approach.

### 4.4 Never Reset State with useEffect

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

---

## 5. Rendering Performance

**Impact: MEDIUM**

Optimizing the rendering process reduces the work the browser needs to do.

### 5.1 Animate SVG Wrapper Instead of SVG Element

Many browsers don't have hardware acceleration for CSS3 animations on SVG elements. Wrap SVG in a `<div>` and animate the wrapper instead.

**Incorrect (animating SVG directly - no hardware acceleration):**

```tsx
function LoadingSpinner() {
  return (
    <svg className="animate-spin" width="24" height="24" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" stroke="currentColor" />
    </svg>
  );
}
```

**Correct (animating wrapper div - hardware accelerated):**

```tsx
function LoadingSpinner() {
  return (
    <div className="animate-spin">
      <svg width="24" height="24" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" stroke="currentColor" />
      </svg>
    </div>
  );
}
```

This applies to all CSS transforms and transitions (`transform`, `opacity`, `translate`, `scale`, `rotate`). The wrapper div allows browsers to use GPU acceleration for smoother animations.

### 5.2 CSS content-visibility for Long Lists

Apply `content-visibility: auto` to defer off-screen rendering.

**CSS:**

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

**Example:**

```tsx
function MessageList({ messages }: { messages: Message[] }) {
  return (
    <div className="overflow-y-auto h-screen">
      {messages.map(msg => (
        <div key={msg.id} className="message-item">
          <Avatar user={msg.author} />
          <div>{msg.content}</div>
        </div>
      ))}
    </div>
  );
}
```

For 1000 messages, browser skips layout/paint for ~990 off-screen items (10× faster initial render).

---

## 6. JavaScript Performance

**Impact: LOW-MEDIUM**

Micro-optimizations for hot paths can add up to meaningful improvements.

### 6.1 Early Length Check for Array Comparisons

When comparing arrays with expensive operations (sorting, deep equality, serialization), check lengths first. If lengths differ, the arrays cannot be equal.

In real-world applications, this optimization is especially valuable when the comparison runs in hot paths (event handlers, render loops).

**Incorrect (always runs expensive comparison):**

```typescript
function hasChanges(current: string[], original: string[]) {
  // Always sorts and joins, even when lengths differ
  return current.sort().join() !== original.sort().join();
}
```

Two O(n log n) sorts run even when `current.length` is 5 and `original.length` is 100. There is also overhead of joining the arrays and comparing the strings.

**Correct (O(1) length check first):**

```typescript
function hasChanges(current: string[], original: string[]) {
  // Early return if lengths differ
  if (current.length !== original.length) {
    return true;
  }
  // Only sort/join when lengths match
  const currentSorted = current.toSorted();
  const originalSorted = original.toSorted();
  for (let i = 0; i < currentSorted.length; i++) {
    if (currentSorted[i] !== originalSorted[i]) {
      return true;
    }
  }
  return false;
}
```

This new approach is more efficient because:

- It avoids the overhead of sorting and joining the arrays when lengths differ
- It avoids consuming memory for the joined strings (especially important for large arrays)
- It avoids mutating the original arrays
- It returns early when a difference is found

### 6.2 Use Set/Map for O(1) Lookups

Convert arrays to Set/Map for repeated membership checks.

**Incorrect (O(n) per check):**

```typescript
const allowedIds = ['a', 'b', 'c', ...]
items.filter(item => allowedIds.includes(item.id))
```

**Correct (O(1) per check):**

```typescript
const allowedIds = new Set(['a', 'b', 'c', ...])
items.filter(item => allowedIds.has(item.id))
```

### 6.3 Use toSorted() Instead of sort() for Immutability

`.sort()` mutates the array in place, which can cause bugs with React state and props. Use `.toSorted()` to create a new sorted array without mutation.

**Incorrect (mutates original array):**

```typescript
function UserList({ users }: { users: User[] }) {
  // Mutates the users prop array!
  const sorted = useMemo(
    () => users.sort((a, b) => a.name.localeCompare(b.name)),
    [users]
  )
  return <div>{sorted.map(renderUser)}</div>
}
```

**Correct (creates new array):**

```typescript
function UserList({ users }: { users: User[] }) {
  // Creates new sorted array, original unchanged
  const sorted = useMemo(
    () => users.toSorted((a, b) => a.name.localeCompare(b.name)),
    [users]
  )
  return <div>{sorted.map(renderUser)}</div>
}
```

**Why this matters in React:**

1. **Props/state mutations break React's immutability model** - React expects props and state to be treated as read-only
2. **Causes stale closure bugs** - Mutating arrays inside closures (callbacks, effects) can lead to unexpected behavior

**Browser support:**

`.toSorted()` is available in all modern browsers (Chrome 110+, Safari 16+, Firefox 115+, Node.js 20+). For older environments, use spread operator:

```typescript
// Fallback for older browsers
const sorted = [...items].sort((a, b) => a.value - b.value);
```

**Other immutable array methods:**

- `.toSorted()` - immutable sort
- `.toReversed()` - immutable reverse
- `.toSpliced()` - immutable splice
- `.with()` - immutable element replacement

---

## 7. Component Structure

**Impact: MEDIUM-HIGH (maintainability)**

Bloated components are hard to test, review, and reuse, and unrelated state changes re-render everything.

### 7.1 One Component or Hook = One Responsibility = One File

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

### 7.2 JSX-Returning Helpers Must Be Components

Any reusable function that returns JSX should be a PascalCase component. Lowercase helpers are for computing values, formatting data, or building props. A helper named `renderX` that returns JSX is a component in practice, so name it and call it like one.

**Incorrect:**

```tsx
const renderJsonCodeBlock = (value: unknown, testId: string) => (
  <div data-testid={testId}>
    <CodeBlock code={JSON.stringify(value, null, 2)} lang="json" />
  </div>
);

export function ToolBadge({ result }: ToolBadgeProps) {
  return <section>{renderJsonCodeBlock(result, 'tool-result')}</section>;
}
```

**Correct:**

```tsx
function JsonCodeBlock({ value, testId }: { value: unknown; testId: string }) {
  return (
    <div data-testid={testId}>
      <CodeBlock code={JSON.stringify(value, null, 2)} lang="json" />
    </div>
  );
}

export function ToolBadge({ result }: ToolBadgeProps) {
  return (
    <section>
      <JsonCodeBlock value={result} testId="tool-result" />
    </section>
  );
}
```

Use a lowercase helper only when it does not return JSX:

```tsx
const formatJson = (value: unknown) => JSON.stringify(value, null, 2) ?? String(value);
```

Smell to catch in reviews: `renderSomething(...)` returning JSX, especially when it accepts props-like arguments or is reused in multiple JSX branches.

---

## 8. Testing

### 8.1 BDD Tests That Mock Only the Network

In `packages/playground` (and `packages/playground-ui`), tests must **drive the real `@mastra/client-js` + React Query stack and only mock the network**, and they must be written **BDD-style**: an outer `describe` names the unit, inner `describe('when …')` blocks name a precondition, and each `it` asserts one outcome.

This rule is **lint-enforced**. `packages/playground/eslint.config.js` adds `no-restricted-syntax` selectors (scoped to `src/**/*.{test,spec}.{ts,tsx}`) that fail CI on any prohibited `vi.mock`. The contract also lives in `packages/playground/AGENTS.md`, and the mechanics live in the `playground-msw-tests` skill — activate it before adding or changing any test here.

**Prohibited** — `vi.mock` of: our own data hooks/services (`@/domains/**/hooks/*`, `@/domains/**/services/*`, `@/hooks/*`), auth gating (`@/domains/auth/**`), domain barrels that re-export them (`@/domains/{agent-builder,llm,agents}`), and the SDK (`@mastra/client-js`, `@mastra/react`). Mocking these replaces the very code paths a test should exercise — the React Query cache, the SDK transport, RBAC capability resolution — so a green test proves nothing about production behavior.

**Allowed seams** (not flagged): MSW network handlers, jsdom DOM-API polyfills in `vitest.setup.ts`, `react-router`'s `Navigate` (to assert a redirect target), a thin stub of a heavy child component that has its own dedicated test, and atoms that need global context.

**Incorrect (mocks auth gating and the SDK; asserts nothing real):**

```tsx
vi.mock('@mastra/react', () => ({
  useMastraClient: () => ({ getBuilderSettings }),
}));
vi.mock('@/domains/auth/hooks/use-permissions', () => ({
  usePermissions: () => ({ hasPermission: () => true, rbacEnabled: true }),
}));

it('shows the editor for permitted users', () => {
  render(<AgentEditPage />);
  expect(screen.getByRole('form')).toBeInTheDocument();
});
```

**Correct (real providers + SDK; capability + data driven by MSW fixtures):**

```tsx
// __tests__/fixtures/capabilities.ts — typed from @mastra/client-js, no `as any`
import type { GetCapabilitiesResponse } from '@mastra/client-js';

export const canEditAgents: GetCapabilitiesResponse = {
  /* … real-shaped capability payload granting agent edit … */
};

// agent-edit.msw.test.tsx
describe('AgentEditPage', () => {
  describe('when the user has the agent-edit capability', () => {
    it('renders the editor form', async () => {
      server.use(http.get('*/api/auth/capabilities', () => HttpResponse.json(canEditAgents)));

      renderWithProviders(<AgentEditPage />);

      expect(await screen.findByRole('form')).toBeInTheDocument();
    });
  });

  describe('when the user lacks the capability', () => {
    it('redirects to the first accessible route', async () => {
      server.use(http.get('*/api/auth/capabilities', () => HttpResponse.json(noCapabilities)));

      renderWithProviders(<AgentEditPage />);

      expect(await screen.findByTestId('navigate')).toHaveAttribute('data-to', '/agents');
    });
  });
});
```

**BDD structure:** outer `describe` = the unit under test; inner `describe('when <context>')` = one precondition (input shape, RBAC capability, feature flag, loading/error/empty/success), each set up with a real MSW fixture; `it('<outcome>')` = one Then (split multi-assert cases). Keep single-context units flat. Fixtures live in a nearby `__tests__/fixtures/` folder, typed from `@mastra/client-js` — no `as any`, no `as unknown as`.

Do not cast test data, MSW responses, request payloads, hook inputs, or component event inputs to force compatibility. Use production response/input types, typed builders, or named helpers. If jsdom lacks a concrete browser primitive, keep the adapter small and typed to the public hook/component boundary so call sites stay cast-free.

When removing a mock surfaces a real product gap, fix the test/fixture or file the gap — never re-mock to hide it. MSW runs with `onUnhandledRequest: 'error'`, so unstubbed requests fail loudly.

---

## References

1. [https://react.dev](https://react.dev)
2. [https://tanstack.com/query](https://tanstack.com/query)
