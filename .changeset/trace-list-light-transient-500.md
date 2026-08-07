---
'@mastra/playground-ui': patch
---

Fixed the Observability traces list permanently falling back to the heavier trace endpoint after a passing server error.

The list asks the server for lightweight trace rows and falls back to the full ones when a server is too old to serve them. A `500` was treated as that signal, so one transient fault — a database hiccup, a request timeout — pinned the tab to the heavier endpoint for the rest of the session, silently undoing the bandwidth savings until a reload. A `500` now falls back for that request only; the session switches for good once the errors have lasted more than ten seconds, which no longer looks like a hiccup. A `404` still switches immediately, since a server without the route will never grow one mid-session.
