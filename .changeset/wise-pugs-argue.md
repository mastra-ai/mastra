---
'mastra': patch
---

Fix three deploy/env usability papercuts: `mastra deploy staging` now fails fast with "Did you mean: mastra deploy --env staging" instead of silently deploying to production, the preflight block message names the exact unblock command (`mastra env db create --kind turso`/`neon` based on the missing variable), and 400 validation errors now show the field name and valid options instead of a bare "invalid fields".
