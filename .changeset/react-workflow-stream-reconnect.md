---
'@mastra/react': patch
---

Fixed workflow runs appearing stuck when a stream is interrupted.

`useStreamWorkflow` treated a stream that ended before the run finished as the end of the run, so the UI kept showing the last step it saw as in progress until the page was reloaded — even though the run completed successfully. Interrupted streams are now reconnected automatically (with backoff, up to five attempts), replaying from the last chunk received so no updates are missed or applied twice. If reconnection does not succeed, `onError` is called instead of leaving the UI in a streaming state.
