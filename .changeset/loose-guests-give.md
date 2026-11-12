---
'@mastra/playground-ui': minor
---

Added host feedback options to trace, span, and thread composers so integrations can select context and hide unsupported delete or review actions.

```tsx
<TracesExplorer
  {...explorerProps}
  feedbackOptions={{ contextMode: 'resolve', feedbackUserId: null, allowDelete: false, allowReview: false }}
>
  {children}
</TracesExplorer>
```

The same options are available on standalone feedback tabs and thread panels. Omitted options preserve existing behavior. Failed submissions now show an error while preserving the draft.
