---
'@mastra/playground-ui': minor
---

Added `useLocalStorageState` for schema-validated browser-local state. The hook restores validated values, persists React-style state updates, and keeps in-memory state usable when storage is unavailable.

```tsx
import { useLocalStorageState } from '@mastra/playground-ui/hooks/use-local-storage-state';
import { z } from 'zod/v4';

const countSchema = z.number();

function Counter() {
  const [count, setCount] = useLocalStorageState({
    initialKey: 'counter',
    defaultValue: 0,
    schema: countSchema,
  });

  return <button onClick={() => setCount(previous => previous + 1)}>{count}</button>;
}
```

`initialKey` and `defaultValue` initialize state once per mount. Remount the consumer with a React `key` when switching storage entries. An optional `serialize` function supports custom storage representations; it defaults to `JSON.stringify`.
