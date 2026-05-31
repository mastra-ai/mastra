---
'mastra': patch
---

Consolidate the CLI's `FileEnvService` into `service.env.ts` (alongside the `EnvService` base class) and remove the duplicate `service.fileEnv.ts` module. Env-file writes now validate keys and reject multiline values, escape regex metacharacters in keys, use a function replacer so `$`-sequences in values are written literally, and no longer log secret values (only the key name is logged).
