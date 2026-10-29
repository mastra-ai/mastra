---
'mastra': patch
---

Experiment worker artifacts keep recording the project's own lockfile (for example `pnpm-lock.yaml`) as the install lockfile, so workers keep installing the exact dependency versions the build resolved.
