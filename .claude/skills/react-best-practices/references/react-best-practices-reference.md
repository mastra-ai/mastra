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

Performance optimization guide for React applications, designed for AI agents and LLMs. Contains 12 rules across 6 categories, prioritized by impact from critical (eliminating waterfalls, reducing bundle size) to incremental (JavaScript micro-optimizations). Each rule includes detailed explanations, real-world examples comparing incorrect vs. correct implementations, and specific impact metrics to guide automated refactoring and code generation.

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
5. [Rendering Performance](#5-rendering-performance) — **MEDIUM**
   - 5.1 [Animate SVG Wrapper Instead of SVG Element](#51-animate-svg-wrapper-instead-of-svg-element)
   - 5.2 [CSS content-visibility for Long Lists](#52-css-content-visibility-for-long-lists)
6. [JavaScript Performance](#6-javascript-performance) — **LOW-MEDIUM**
   - 6.1 [Early Length Check for Array Comparisons](#61-early-length-check-for-array-comparisons)
   - 6.2 [Use Set/Map for O(1) Lookups](#62-use-setmap-for-o1-lookups)
   - 6.3 [Use toSorted() Instead of sort() for Immutability](#63-use-tosorted-instead-of-sort-for-immutability)

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

## References

1. [https://react.dev](https://react.dev)
2. [https://tanstack.com/query](https://tanstack.com/query)
