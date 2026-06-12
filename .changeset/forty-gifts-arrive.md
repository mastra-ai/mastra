---
'@mastra/railway': patch
---

Improved process execution by using Railway SDK's native `cwd` and `env` exec options.
Commands now run with the configured working directory and environment variables without client-side shell wrapping.
