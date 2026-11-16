---
'@mastra/react': patch
'@mastra/playground-ui': patch
---

New feedback comments now show up in the list as soon as you submit them, instead of after the next refresh. Lists from `useTraceFeedback` and `useSpanFeedback` show the comment right away, remove it if the submit fails, and keep showing it until the list returns the stored comment or 60 seconds pass, whichever comes first. While a comment is waiting to be stored, the list refreshes every 3 seconds instead of every 30 seconds.

Comments that are not stored yet have `isPending: true`, so you can hide actions such as delete until the stored comment arrives:

```tsx
const { data } = useTraceFeedback({ traceId });

data?.feedback.map(item => (item.isPending ? <span>Sending…</span> : <FeedbackActions item={item} />));
```

In Studio, a comment that is not stored yet shows "Sending…" instead of its review status, and its Mark reviewed and Delete actions stay hidden until the stored comment arrives.

`useCreateFeedback` now runs your `onMutate`, `onError` and `onSuccess` options in addition to its own behavior. Before, passing `onSuccess` skipped the hook's list refresh.
