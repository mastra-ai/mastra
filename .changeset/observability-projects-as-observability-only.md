---
'mastra': patch
'create-mastra': patch
---

Mastra Observability provisioning now creates new platform projects as observability-only (no Studio or Server runtime attached). The first `mastra studio deploy` or `mastra server deploy` flips the matching runtime flag, so projects are no longer mislabelled as Studio in the platform UI before any deploy has happened.
