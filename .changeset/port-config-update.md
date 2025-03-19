---
"@mastra/deployer": patch
"mastra": patch
---

Add port configuration support for build command and server creation.

- Added `--port` flag to `mastra build` command to configure server port
- Added port parameter to `createNodeServer` function
- Updated build process to properly handle port configuration
- Improved port handling in development and production environments
- Port is now determined in this order:
  1. Command line argument (--port)
  2. Environment variable (process.env.PORT)
  3. Default value (4111)
