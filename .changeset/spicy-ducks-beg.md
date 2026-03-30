---
'@mastra/core': patch
---

Fixed models.dev auth env selection to prefer auth credentials over URL path identifiers, so Cloudflare Workers AI no longer uses the account ID for authentication.
