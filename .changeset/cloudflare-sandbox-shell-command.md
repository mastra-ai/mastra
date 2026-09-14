---
'@mastra/cloudflare-sandbox': patch
---

Run bare Workspace command strings through `/bin/bash -c` so the built-in `execute_command` tool works on CloudflareSandbox. Previously a command string supplied without separate arguments was sent to the bridge as a single executable name and failed with exit 127 (`command not found`). Explicit argument arrays remain literal.
