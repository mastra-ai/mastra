---
'@mastra/server': patch
---

Fixed the Knowledge importer webhook route skipping fine-grained authorization. When an FGA provider is configured, `POST /knowledge/:instanceKey/importers/:importerId/webhook` now checks the caller for `knowledge:write` on the `knowledge-importer` resource for that instance and importer and returns 403 when the provider refuses. Previously the route only required authentication, so any signed-in user could trigger any importer.
