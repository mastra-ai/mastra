---
'mastra': patch
---

`mastra deploy` no longer requires a local `.env` or `.env.<name>` file when the target environment already has env vars stored on Mastra Cloud. Previously the command errored with "No env file found for deploy" even when Cloud held the canonical env vars for that environment.

If an explicit `--env-file` is passed, or a `.env*` file exists in the project, behavior is unchanged: those vars are read and layered on top of the environment's stored env vars for that deploy (Cloud is the base, local values win). If neither is present, the deploy proceeds with an empty local payload and Cloud's stored env vars are used as-is. `mastra studio deploy` and `mastra server deploy` are unchanged.
