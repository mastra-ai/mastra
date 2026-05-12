---
'mastra': patch
---

Add `mastra verify` command — validate that a Mastra project is ready to deploy without uploading anything.

`mastra verify` runs the same preflight checks as `mastra studio deploy` and `mastra server deploy` (missing env vars, host-local storage paths) but stops after reporting issues. Useful as a CI gate, a pre-commit hook, or while iterating locally.

```bash
# basic usage — runs `mastra build` then validates
mastra verify

# skip the build step and check the existing .mastra/output
mastra verify --skip-build

# validate against a specific env file
mastra verify --env-file .env.production

# treat warnings as errors (good for CI)
mastra verify --strict

# machine-readable output for CI tooling
mastra verify --json
```

Exit codes:
- `0` — preflight passed (no issues, or warnings only)
- `1` — at least one error-severity issue, or any issue in `--strict` mode
