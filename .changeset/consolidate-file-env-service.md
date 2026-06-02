---
'mastra': patch
---

Consolidated the CLI's env-file handling into a single module. `FileEnvService` now lives alongside its `EnvService` base class (the standalone `service.fileEnv.ts` and its stale "copied from admin" TODO are removed), and the env-writing path was hardened: keys are validated against a safe identifier pattern, values containing newlines are rejected, regex metacharacters in keys are escaped, replacement no longer interprets `$` sequences in values, and the success log no longer prints env values. `getEnvValue` now returns an empty string for an empty entry instead of `null`.
