---
'@mastra/playground-ui': minor
---

Added `SessionSurface` and `SessionComposer` so any host can render a Factory-style session page: transcript, task panel, loading veil and docked composer. The host passes the conversation as children, so its error notice can replace the older-history loader (`TranscriptHistoryLoader`), the empty state and the transcript together. Factory now renders its session page through them, with no change in behavior.

```tsx
import { SessionComposer, SessionSurface, TranscriptEntries } from '@mastra/playground-ui/domains/chat/transcript';

<SessionSurface
  busy={busy}
  preparing={loadingFirstPage}
  tasks={tasks}
  loadMore={{ hasMore, isLoading, load: loadOlder }}
  composerLabel="Message composer"
  composer={
    <SessionComposer
      onSubmit={send}
      busy={busy}
      images={images}
      onRemoveImage={removeImage}
      input={{ value: draft, onChange: event => setDraft(event.target.value) }}
      showAbort={busy}
      sendDisabled={!draft.trim()}
      onAbort={abort}
    />
  }
>
  <TranscriptEntries entries={transcript.entries} onApprove={approve} onRespond={respond} />
</SessionSurface>
```

Annotations are opt-in. Inside a `ChatAnnotationsProvider`, add `<TranscriptAnnotations />` to the children and pass `annotations={<ComposerAnnotations />}` to `SessionComposer`.
