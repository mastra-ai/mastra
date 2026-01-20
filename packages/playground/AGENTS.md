# Local Studio Standards

Standards and conventions for building the local studio in `packages/playground`.

---

## Commands

### Local Commands (run from `packages/playground`)

- `pnpm dev`: Start Vite development server
- `pnpm build`: Build the playground with Vite
- `pnpm build:watch`: Build in watch mode
- `pnpm preview`: Preview the production build
- `pnpm lint`: Run ESLint

### Root Commands (run from monorepo root)

- `pnpm dev:playground`: Start dev servers for playground, playground-ui, and react client SDK
- `pnpm build:cli`: Build the CLI (includes playground and playground-ui as dependencies)

## Package Architecture

### Scope

`packages/playground` is a local development studio built with React Router that composes primitives from `packages/playground-ui`.

### Responsibilities

- **Route Configuration**: Define React Router routes and pages
- **Component Composition**: Assemble pages using `packages/playground-ui` primitives
- **FORBIDDEN**: Creating new UI components, layouts, or data-fetching logic

### Architecture Principle

This package is a **thin composition layer** only. All reusable logic must live in `packages/playground-ui`.

---

## Component Composition Pattern

Pages should compose high-level components from `packages/playground-ui` with minimal custom logic.

### Examples

```tsx
// ✅ Good - Compose existing components
import { useParams } from 'react-router';
import { AgentsTable, AgentInformation } from '@mastra/playground-ui';

export function AgentsPage() {
  const { agentId } = useParams();

  return (
    <div className="grid grid-cols-2">
      <AgentsTable agentId={agentId} />
      <AgentInformation agentId={agentId} />
    </div>
  );
}
```

```tsx
// ❌ Bad - Reimplementing UI and data fetching
import { useParams } from 'react-router';
import { useAgent, useAgents } from '@mastra/playground-ui';

export function AgentsPage() {
  const { agentId } = useParams();
  const { data: agent, isLoading } = useAgent(agentId);
  const { data: agents, isLoading: isLoadingAgents } = useAgents();

  if (isLoading || isLoadingAgents) return <div>Loading...</div>;

  return (
    <div className="grid grid-cols-2">
      <div>Agent name: {agent.name}</div>
      <ul>
        {agents.map(item => (
          <li key={item.id}>{item.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

---

## Coding Conventions

### Naming

- **Components**: PascalCase (e.g., `AgentsPage`)
- **Files**: kebab-case (e.g., `agents-page.tsx`)

### Exports

- Use **named exports** only
- Avoid default exports

```tsx
// ✅ Good
export function AgentsPage() { ... }

// ❌ Bad
export default function AgentsPage() { ... }
```

### Reusability

- Before creating a component, check if it exists in `packages/playground-ui`
- If a component doesn't exist in `playground-ui`, create it there first

---

## React Code Style

### Data Fetching

- **FORBIDDEN**: Data fetching in this package
- All hooks must be imported from `packages/playground-ui`

### Type Definitions

- **REQUIRED**: Export explicit prop types separately

```tsx
// ✅ Good
export type AgentsPageProps = { initialTab?: string };
export function AgentsPage({ initialTab }: AgentsPageProps) {
  return <div>{initialTab}</div>;
}

// ❌ Bad
export function AgentsPage({ initialTab }: { initialTab?: string }) {
  return <div>{initialTab}</div>;
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

- This package is **composition only** - no business logic
- All UI components must come from `packages/playground-ui`
- All data-fetching hooks must come from `packages/playground-ui`
- Pages should be thin wrappers around `playground-ui` components
- When in doubt, add functionality to `playground-ui` instead

## E2E Testing (MUST DO)

On every change to this package, you MUST use the `e2e-frontend-validation` skill
