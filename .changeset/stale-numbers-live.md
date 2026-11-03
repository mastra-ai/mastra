---
"@mastra/server": minor
---

Add explicit context modes to feedback and score POSTs. Omitted mode preserves OSS direct writes; `resolve` derives stored root/target context and reports structured missing-anchor errors. Accept supplied timestamps and return normalized identity data.

```ts
await client.createFeedback({
  contextMode: 'resolve',
  feedback: { traceId, feedbackType: 'thumbs', value: 1 },
});
```

Platform retains its resolve default. Older servers may ignore the selector; explicit modes require supporting server versions.
