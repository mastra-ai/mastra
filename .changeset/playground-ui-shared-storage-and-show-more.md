---
'@mastra/playground-ui': minor
---

Added `createLocalStorageStore` and `useLocalStorageStore` for a browser-stored value that every component reading it shares, along with other tabs. Unlike `useLocalStorageState`, a write updates every reader at once. A write that storage refuses still applies for the rest of the session.

```tsx
import { createLocalStorageStore, useLocalStorageStore } from '@mastra/playground-ui/hooks/use-local-storage-store';

const pinnedStore = createLocalStorageStore<ReadonlySet<string>>({
  key: 'app.pinned',
  defaultValue: new Set(),
  parse: stored => {
    if (!Array.isArray(stored)) throw new Error('not a list of ids');
    return new Set(stored.filter(id => typeof id === 'string'));
  },
  toJSON: pinned => [...pinned],
});

function PinButton({ threadId }: { threadId: string }) {
  const pinned = useLocalStorageStore(pinnedStore);
  return <button onClick={() => pinnedStore.write(new Set([...pinned, threadId]))}>Pin</button>;
}
```

Added `Sidebar.NavShowMore`, a "Show N more" / "Show less" toggle for a sidebar list cut to its first rows. It hides itself when nothing is cut off or when the sidebar is collapsed to its icon rail.

```tsx
<Sidebar.NavList>{(expanded ? threads : threads.slice(0, 5)).map(renderThread)}</Sidebar.NavList>
<Sidebar.NavShowMore foldedCount={threads.length - 5} expanded={expanded} onExpandedChange={setExpanded} />
```
