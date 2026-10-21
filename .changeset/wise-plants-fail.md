---
'@mastra/playground-ui': minor
---

Trace drawers now come with their Feedback, span Feedback and Scores tabs built in, and app-specific actions are provided once through the new `TracePanelHostProvider` instead of being passed to every panel. Opening a trace in the Traces explorer no longer re-renders the whole drawer on each auto-refresh tick.

**Removed props**

- `TraceSpanPanel`: `feedbackTabBadge`, `feedbackTabSlot`, `scoresTabBadge`, `scoresTabSlot`, `spanFeedbackTabBadge`, `spanFeedbackTabSlot`, `initialSpanId`, `headerActionsSlot`, `onOpenScore`. Feedback tabs show when `withFeedback` is set; the Scores tab always shows. Pass `onScoreSelect` to handle score clicks in place.
- `TraceThreadPanel` and `ThreadViewByTrace`: `onOpenScore`.
- `TracesExplorer.Panel`: `onOpenScore`, `headerActionsSlot`, `renderCreateDatasetDialog`.

**Before**

```tsx
<TraceSpanPanel
  traceId={traceId}
  spans={spans}
  feedbackTabBadge={feedback?.pagination.total}
  feedbackTabSlot={() => <TraceFeedbackTab traceId={traceId} />}
  scoresTabSlot={() => <TraceScoresTab traceId={traceId} spanId={rootSpanId} onScoreSelect={openScore} />}
  headerActionsSlot={<RecordingReview traceId={traceId} spans={spans} />}
  onOpenScore={(traceId, scoreId) => navigate(scoreLink(traceId, scoreId))}
/>
```

**After**

```tsx
import { TracePanelHostProvider } from '@mastra/playground-ui';

// Mount once near the root of your app
<TracePanelHostProvider
  value={{
    openScore: (traceId, scoreId) => navigate(scoreLink(traceId, scoreId)),
    renderHeaderActions: ({ traceId, spans }) => <RecordingReview traceId={traceId} spans={spans} />,
    renderCreateDatasetDialog: props => <CreateDatasetDialog {...props} />,
  }}
>
  <App />
</TracePanelHostProvider>;

// Panels no longer need the wiring
<TraceSpanPanel traceId={traceId} spans={spans} withFeedback />;
```

Without a provider, score cards are read-only and no header actions or "Create dataset" option are shown.
