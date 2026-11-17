---
'@mastra/factory': patch
'mastra': patch
---

Reduced the work the Factory server does to keep the session sidebar and board up to date.

- `GET /web/factory/projects/:id/session-rows` now also returns `activity`, the same answer as `GET /web/factory/projects/:id/session-activity`. A page that shows the sidebar gets both from one request, so the sidebar and the board always show the same moment.
- Requests that arrive together now share one session owner lookup instead of each asking the auth provider.
- Projects without a linked repository no longer rebuild their session list on every sidebar poll.
- A session's first materialize, first message and first command are now recorded once when several server replicas serve it.
