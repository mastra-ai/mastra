---
'@mastra/auth-studio': patch
---

Changed the default shared API URL for Studio auth from http://localhost:3010/v1 to https://platform.mastra.ai/v1, so deployed instances work against the production platform without extra configuration. Set MASTRA_SHARED_API_URL or the sharedApiUrl option to point at a different environment. Production cookie settings (Secure + Domain=.mastra.ai) are now only auto-enabled when the shared API URL is explicitly configured on .mastra.ai, keeping local development cookies host-only.
