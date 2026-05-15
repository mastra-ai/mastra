---
'@internal/playground': patch
---

Fixed Studio credentials sign-in and sign-up to respect the configured API prefix instead of hardcoding `/api`. When the server is started with a custom `--server-api-prefix` (or `apiPrefix` option), the auth endpoints now derive from `MastraClient.options.apiPrefix` and forward any configured client headers, matching the behavior of the other auth hooks. Added Vitest coverage for prefix normalization, header forwarding, and error handling.
