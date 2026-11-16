---
'@mastra/react': patch
---

New feedback comments now show up in the list as soon as you submit them, instead of after the next refresh. Lists from `useTraceFeedback` and `useSpanFeedback` show the comment right away, remove it if the submit fails, and keep showing it until the list returns the stored comment or 60 seconds pass, whichever comes first.

Feedback lists also refresh every 3 seconds instead of every 30 seconds, so reviewed or deleted feedback updates sooner.

`useCreateFeedback` now runs your `onMutate`, `onError` and `onSuccess` options in addition to its own behavior. Before, passing `onSuccess` skipped the hook's list refresh.
