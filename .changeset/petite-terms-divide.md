---
'@mastra/server': patch
---

Fixed Studio Datasets page only showing the first 10 datasets. The `GET /datasets` handler now defaults to 20 per page (matching the core `DatasetsManager` default) and properly paginates when explicit `page`/`perPage` params are provided. Closes [#14631](https://github.com/mastra-ai/mastra/issues/14631).
