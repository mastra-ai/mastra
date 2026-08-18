---
'@mastra/pg': patch
---

Improved workflow run list performance in `@mastra/pg` when filtering by workflow name. The default index avoids sorting the ordered result query for workflows with large run histories. Paginated requests still use a separate count query.
