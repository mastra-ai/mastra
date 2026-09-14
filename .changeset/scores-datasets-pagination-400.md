---
'@mastra/server': patch
---

Fixed score, dataset, and background-task list endpoints to return `400 Bad Request` for invalid `page` or `perPage` values, such as `?perPage=2.5` or `?page=-1`, instead of `500 Internal Server Error`.
