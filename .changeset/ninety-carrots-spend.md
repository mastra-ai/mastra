---
'@mastra/posthog': minor
---

Added feedback export to the PostHog observability exporter. Feedback recorded with `addFeedback()` now flows to PostHog as native `$ai_feedback` events and appears as "User feedback" on the linked trace, alongside the traces the exporter already sends. No configuration changes are needed.

```typescript
const trace = await mastra.observability.getRecordedTrace({ traceId });
await trace.addFeedback({
  feedbackType: 'thumbs',
  value: 'down',
  comment: 'Wrong answer',
});
// The PostHog exporter now forwards this as a $ai_feedback event
```

Fixes https://github.com/mastra-ai/mastra/issues/19893
