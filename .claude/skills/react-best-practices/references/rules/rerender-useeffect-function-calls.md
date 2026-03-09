---
title: useEffectEvent when using functions in useEffect
impact: MEDIUM
impactDescription: unnecessary memoization when not needed
tags: rerender, performance, hooks, useEffect
---

## useEffectEvent when using functions in useEffect

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
