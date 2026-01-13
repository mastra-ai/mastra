# Frontend Component Standards

Standards and conventions for building components in `packages/playground-ui`.

---

## Commands

### Local Commands (run from `packages/playground-ui`)

- `pnpm build`: TypeCheck and build the package with Vite
- `pnpm dev`: Build in watch mode
- `pnpm test`: Run tests with Vitest
- `pnpm preview`: Preview the production build
- `pnpm storybook`: Start Storybook dev server on port 6006
- `pnpm build-storybook`: Build Storybook for production

### Root Commands (run from monorepo root)

- `pnpm dev:playground`: Start dev servers for playground, playground-ui, and react client SDK
- `pnpm build:cli`: Build the CLI (includes playground and playground-ui as dependencies)

---

## Package Architecture

### Scope

`packages/playground-ui` provides shared UI and business logic primitives for multiple studio environments.

### Target Environments

- **Local Studio**: Development server using React Router
- **Cloud Studio**: Production SaaS using Next.js

### Responsibilities

- **UI Components**: Reusable presentational components
- **Business Hooks**: Data-fetching and state management (`src/domains`)
  - Examples: `useAgents()`, `useWorkflows()`
- **Business Components**: Domain-specific components (`src/domains`)
  - Examples: `<AgentsTable>`, `<AgentInformation>`

---

## Styling Guidelines

### Tailwind CSS (v3.x)

- Use Tailwind for all styling
- **REQUIRED**: Use design tokens from `src/ds/tokens/index.ts`
- **FORBIDDEN**: Arbitrary values (e.g., `bg-[#1A1A1A]`) unless explicitly requested

#### Examples

```tsx
// ❌ Bad
<div className="bg-[#1A1A1A] shadow-[0_4px_12px_rgba(0,0,0,0.5)]" />

// ✅ Good
<div className="bg-surface4 shadow-lg" />
```

### Complex Styles

- Prefer Tailwind utilities over custom CSS files for shadows, gradients, etc.
- Only use CSS files when Tailwind cannot express the style

---

## Coding Conventions

### Naming

- **Components**: PascalCase (e.g., `EntryList`)
- **Files**: kebab-case (e.g., `entry-list.tsx`)

### Exports

- Use **named exports** only
- Avoid default exports

```tsx
// ✅ Good
export function EntryList() { ... }

// ❌ Bad
export default function EntryList() { ... }
```

### Reusability

- Before creating a component, verify it doesn't already exist
- Reuse existing components instead of duplicating

---

## React Code Style

### Data Fetching

- **REQUIRED**: Use TanStack Query for all data fetching hooks
- **REQUIRED**: Use `useMastraClient` SDK for API calls
- **FORBIDDEN**: Direct `fetch()` calls

```tsx
// ✅ Good
import { useMastraClient } from '.@mastra/react';
import { useQuery } from '@tanstack/react-query';

export function useAgents() {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['agents'],
    queryFn: () => client.getAgents(),
  });
}

// ❌ Bad
export function useAgents() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(setData);
  }, []);
  return data;
}
```

### Type Definitions

- **REQUIRED**: Export explicit prop types separately
- Keep type definitions alongside components

```tsx
// ✅ Good
export type AppProps = { a: number; b: number };
export function App({ a, b }: AppProps) {
  return <div>{a + b}</div>;
}

// ❌ Bad
export function App({ a, b }: { a: number; b: number }) {
  return <div>{a + b}</div>;
}
```

### State Management

- Prefer derived values over `useState` + `useEffect`
- Minimize `useEffect` usage
- Calculate values directly when possible

```tsx
// ✅ Good
export type AppProps = { a: number; b: number };
export function App({ a, b }: AppProps) {
  return <div>{a + b}</div>;
}

// ❌ Bad
export type AppProps = { a: number; b: number };
export function App({ a, b }: AppProps) {
  const [result, setResult] = useState<number>(0);

  useEffect(() => {
    setResult(a + b);
  }, [a, b]);

  return <div>{result}</div>;
}
```

### Memoization & Performance

- **FORBIDDEN**: Using `useCallback` or `useMemo` for typical operations
- Only use `useCallback`/`useMemo` as a **last resort** for very expensive computations (e.g., processing 200+ entries)
- **REQUIRED**: Use React 19.2's `useEffectEvent` instead of `useCallback` for event handlers

```tsx
// ✅ Good - useEffectEvent for event handlers (React 19.2+)
import { useEffectEvent } from 'react';

export function App() {
  const onSubmit = useEffectEvent((data: FormData) => {
    // handle submission
  });

  return <Form onSubmit={onSubmit} />;
}

// ❌ Bad - useCallback for simple event handlers
export function App() {
  const onSubmit = useCallback((data: FormData) => {
    // handle submission
  }, []);

  return <Form onSubmit={onSubmit} />;
}
```

```tsx
// ✅ Good - useMemo ONLY for expensive computations (200+ items)
const sortedItems = useMemo(() => {
  return hugeDataset.sort((a, b) => a.value - b.value);
}, [hugeDataset]); // hugeDataset has 500+ entries

// ❌ Bad - useMemo for simple derivations
const fullName = useMemo(() => {
  return `${firstName} ${lastName}`;
}, [firstName, lastName]);

// ✅ Good - derive directly instead
const fullName = `${firstName} ${lastName}`;
```

### Side Effects

- **REQUIRED**: Isolate every `useEffect` into a custom hook
- Direct `useEffect` usage in components creates noise and reduces readability
- Custom hooks encapsulate side effects and make components cleaner

```tsx
// ✅ Good - useEffect isolated in custom hook
function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title;
  }, [title]);
}

export function AgentPage({ agent }: AgentPageProps) {
  useDocumentTitle(`Agent: ${agent.name}`);
  return <div>{agent.name}</div>;
}

// ❌ Bad - useEffect directly in component
export function AgentPage({ agent }: AgentPageProps) {
  useEffect(() => {
    document.title = `Agent: ${agent.name}`;
  }, [agent.name]);

  return <div>{agent.name}</div>;
}
```

---

## Key Principles

- All components must work in both React Router and Next.js
- Keep business logic in `src/domain` sub-folders
- Maintain environment-agnostic design
- Prioritize design system tokens for consistency
- Minimize side effects and state management
- Use TanStack Query for all server state


## E2E Testing (MUST DO)

On every change to this package, you MUST use the `e2e-frontend-validation` skill