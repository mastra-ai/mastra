---
'@mastra/core': patch
---

Fixed models.dev provider URLs to interpolate environment variable placeholders like `${ACCOUNT_ID}` before creating the underlying provider client.
