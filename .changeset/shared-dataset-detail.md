---
'@mastra/playground-ui': minor
'mastra': patch
---

Shared the dataset detail views (items list, item panel, add/import/export dialogs, version history) and experiment comparison components from `@mastra/playground-ui`, so apps other than Studio can render a dataset's items. These components take URL state (`searchParams`, `setSearchParams`, `currentItemId`) as props and navigate through the app's `paths.datasetLink`/`paths.datasetItemLink`.
