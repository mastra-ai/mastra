---
'@mastra/factory': patch
---

Added a `source` filter to `GET /web/factory/projects/:id/session-rows`. It keeps the sessions from one place: `board:<board id>` for a board's cards, `user` for sessions a person started, or `slack` for sessions started from Slack. These are the same keys that `groupBy=board` groups by.

```
GET /web/factory/projects/:id/session-rows?source=slack
```
