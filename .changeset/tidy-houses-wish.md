---
'@mastra/react': minor
---

Deleted feedback no longer looks like it stayed. On servers that delete feedback in the background (such as Mastra Platform), `useTraceFeedback` and `useSpanFeedback` now mark a row with `deleteStatus: 'deleting'` after `useDeleteFeedback` succeeds, and keep checking until the server stops returning it. If the row is still there after 5 minutes, it is marked `deleteStatus: 'failed'` instead.

```tsx
const { data } = useTraceFeedback({ traceId });
data?.feedback.map(item => (item.deleteStatus === 'deleting' ? 'Deleting…' : item.value));
```

A caller `onSuccess` passed to `useDeleteFeedback` now runs in addition to the list refresh, not instead of it.
