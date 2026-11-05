---
'@mastra/react': minor
---

Added explicit feedback author and context-mode options to useCreateFeedback. The hook returns the server response, including its identity and timestamp.

```tsx
const mutation = useCreateFeedback({ traceId, contextMode: 'resolve', feedbackUserId: null });
const result = await mutation.mutateAsync({ text: 'Useful response' });
```

Omit the new options to preserve existing server defaults. The client still supplies missing IDs and timestamps; retain the returned identity and timestamp for later replacement writes.
