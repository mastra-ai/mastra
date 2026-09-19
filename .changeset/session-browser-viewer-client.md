---
'@mastra/client-js': minor
---

Add `session.browser(incarnation)` for existing exact-thread browsers. Use `viewer.subscribe({ onEvent, onError })` to receive frames and tabs, `viewer.command({ type: 'navigate', url })` to navigate, and `viewer.dispose()` to cancel pending input. Commands are ordered and never retried.
