---
"@mastra/deployer-cloudflare": minor
---

Remove scope, auth, and cloudflare client from CloudflareDeployer

BREAKING CHANGES:
- Remove `scope` property and constructor parameter
- Remove `auth` parameter from constructor 
- Remove private `cloudflare` client property and initialization
- Update `tagWorker` method to throw error directing users to Cloudflare dashboard
- Remove unused Cloudflare import

This simplifies the CloudflareDeployer API by removing external dependencies and authentication requirements. Users should now use the Cloudflare dashboard or API directly for operations that previously required the cloudflare client.