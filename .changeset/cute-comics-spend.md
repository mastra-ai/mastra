---
'@mastra/playground-ui': patch
---

Added an `excludeParams` option to `useTraceFilterPersistence`. Listed filters stay in the URL but are never saved or restored, so a filter that only carries navigation context (such as the conversation an agent Traces tab was opened from) does not come back on a later visit.

```tsx
const setPersistedSearchParams = useTraceFilterPersistence(searchParams, setSearchParams, {
  storageKey: 'mastra:traces:saved-filters:agent:weather-agent',
  // Keep the thread filter in the URL, but never save or restore it
  excludeParams: ['filterThreadId'],
});
```
