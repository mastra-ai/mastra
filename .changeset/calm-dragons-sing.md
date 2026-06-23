---
'mastracode': patch
---

Render a thread's existing messages when you select it in the web app.
Selecting a thread (or resuming one on load) only switched the session and
cleared the transcript — the thread's history isn't replayed over the event
stream, so the view stayed empty until a new message arrived. The app now loads
the thread's messages via `listMessages` and hydrates the transcript, so the
full prior conversation shows immediately on switch and on reconnect.
