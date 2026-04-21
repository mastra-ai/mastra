---
'@mastra/playground-ui': minor
---

Added `ErrorBoundary` component to catch and display runtime errors in the studio. Wraps routes in the local playground so a crash on one page (e.g. an agent editor referencing an unresolved workspace skill) surfaces a friendly recovery UI with **Try again** (in-place React reset), **Reload page** (full browser refresh), and **Report issue** (opens the Mastra GitHub issues page in a new tab) actions, plus a collapsible stack trace — instead of a blank screen.

The fallback is spatially aware: it fills its parent and the icon, heading, and body text scale up on wider containers via Tailwind container queries. Scope the boundary to a single widget to keep the rest of the UI interactive while one panel fails.

**Usage**

```tsx
import { ErrorBoundary } from '@mastra/playground-ui';
import { useLocation } from 'react-router';

// Route-level: wrap the router outlet, reset when the path changes
function Layout({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKeys={[pathname]}>{children}</ErrorBoundary>;
}

// Scoped: contain the crash to one panel, leave the rest of the tree alone
<ErrorBoundary variant="inline" title="The editor failed to render">
  <AgentEditor />
</ErrorBoundary>;
```

Props: `fallback` (node or render prop with `{ error, errorInfo, reset }`), `onError` for reporting, `resetKeys` for automatic reset, `variant` (`'section'` — fills available space, default; `'inline'` — stays compact), and `title` / `description` overrides.
