---
mastra: patch
@mastra/playground-ui: patch
---

Added `--server-api-prefix` and `--auth-header` CLI options to `mastra studio` command for connecting to servers with custom API routes and authentication.

**Why:** When running Mastra behind a server adapter (e.g., Hono on Cloudflare Workers), the API routes may be prefixed (like `/api/v1`) and require authentication headers. Previously, Studio could only connect to the default `/api` route without authentication. These new options allow developers to specify custom API prefixes and auth headers when launching Studio, enabling seamless local development against deployed Mastra instances with custom routing and authentication.

**Before:**

```bash
# No way to specify custom API prefix or auth headers
mastra studio
# Could only connect to http://localhost:4111/api with no authentication
```

**After:**

```bash
# Connect to server with custom API prefix
mastra studio --server-api-prefix /api/v1 --server-host myapp.vercel.app

# Connect with authentication header
mastra studio --auth-header "Authorization: Bearer mytoken"

# Combine both options for production testing
mastra studio \
  --server-host production.example.com \
  --server-api-prefix /api/v2 \
  --auth-header "x-api-key: prod-key-123"
```

**Security:** User-provided values are now properly escaped before injection into HTML script tags to prevent XSS attacks.
