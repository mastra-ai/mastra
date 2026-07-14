---
'mastra': patch
---

`mastra server deploy` and `mastra studio deploy` no longer fail with "No env file found for deploy" when the project has no `.env*` file (e.g. in CI). Like `mastra deploy`, they now proceed without uploading env vars so the vars stored on the platform are used, and preflight reports unverifiable env-guarded paths as warnings instead of errors.
