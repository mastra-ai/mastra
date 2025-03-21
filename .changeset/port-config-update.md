---
"@mastra/deployer": patch
"mastra": patch
---

Add port configuration support for build command and server creation.

- Added port parameter to `createNodeServer` function
- Improved port handling in development environments
- Port is now determined in this order:
  1. Command line argument (--port) (DEV ONLY)
  2. Environment variable (process.env.PORT)
  3. Default value (4111)
