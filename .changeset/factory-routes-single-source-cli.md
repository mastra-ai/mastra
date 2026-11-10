---
'mastra': patch
---

`mastra api factory intake-route list` now returns `canEdit`, which says whether you may change the project's routes, and `intake-route create` adds the route ahead of the project's default "Everything else" route so it can match new cards. Route conditions also accept the new `source.repository`, `source.provider`, `item.key`, `item.state` and `item.assignees` fields.
