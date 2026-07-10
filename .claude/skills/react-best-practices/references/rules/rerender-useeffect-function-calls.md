---
title: Use Effect Events only for effect-fired logic
impact: MEDIUM
impactDescription: correct callback semantics without unnecessary memoization
tags: rerender, performance, hooks, useEffect
---

## Use Effect Events only for effect-fired logic

Ordinary user-event handlers should usually be plain functions. Add `useCallback` only when a stable function identity has a real consumer, such as a memoized child or another Hook dependency.

`useEffectEvent` solves a different problem: it lets logic triggered from an Effect read the latest props and state without causing the Effect to resubscribe. Do not pass an Effect Event to JSX or to child components.

**Incorrect (unnecessary memoization for an ordinary event handler):**

```tsx
import { useCallback } from 'react';

export function App() {
  const onSubmit = useCallback((data: FormData) => {
    // handle submission
  }, []);

  return <Form onSubmit={onSubmit} />;
}
```

**Correct (plain function for an ordinary event handler):**

```tsx
export function App() {
  const onSubmit = (data: FormData) => {
    // handle submission
  };

  return <Form onSubmit={onSubmit} />;
}
```

**Correct (`useEffectEvent` for logic called from an Effect):**

```tsx
import { useEffect, useEffectEvent } from 'react';

export function ChatRoom({ roomId, theme }: ChatRoomProps) {
  const onConnected = useEffectEvent(() => {
    showNotification('Connected!', theme);
  });

  useEffect(() => {
    const connection = createConnection(roomId);
    connection.on('connected', onConnected);
    connection.connect();

    return () => connection.disconnect();
  }, [roomId]);
}
```

Use plain functions for user events. Use `useCallback` when stable identity is necessary, and use `useEffectEvent` only for non-reactive logic invoked from an Effect.
