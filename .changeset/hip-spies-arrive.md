---
'mastra': minor
---

Deploy now offers to attach a managed database inline when preflight would otherwise block on a missing database env var (`TURSO_DATABASE_URL`, `DATABASE_URL`, ...). Previously the CLI errored out and told you to run `mastra env db create` yourself, then re-run `mastra deploy`.

The new flow:

```
Preflight needs TURSO_DATABASE_URL for the production environment.
Create a managed turso database now and attach it? (Y/n)
```

Answer yes and the CLI provisions the database, attaches it to the target environment (scoped, not shared), and continues the deploy in the same run. Answer no, or run in a non-interactive shell (CI, `--yes`), and the CLI falls back to the previous behavior and prints the exact `mastra env db create --kind ...` command as remediation.

The prompt only appears in an interactive TTY. `--yes` never silently creates infrastructure — it just skips the prompt and leaves the original preflight error in place, so CI stays deterministic. Resolves the deploy-time papercut tracked in the deploy-experience issue on `create-mastra` auto-provisioning: no manual command, no CLI restart, no extra login step.
