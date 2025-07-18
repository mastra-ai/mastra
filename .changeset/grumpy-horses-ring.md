---
'@mastra/pg': minor
---

Updated PostgresStore to use the pg-pool package rather than pg-promise to help resolve an issue on Cloudflare Workers. If you're manually managing queries using the exposed pgPromise instance, remove all references to store.pgp and update your syntax to using pg-pool queries rather than pg-promise methods.
