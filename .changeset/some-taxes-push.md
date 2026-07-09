---
'mastra': patch
---

Fixed `mastra deploy` preflight blocking deploys that are actually fine:

**Env-guarded storage fallbacks** — code like `process.env.TURSO_DATABASE_URL || "file:./.mastra-demo.db"` no longer hard-errors when the environment variable is provided for the deploy. If the variable is missing from your env file you still get an error, and if no env file is available you get a warning instead.

**Library env-var false positives** — the missing environment variable check now only looks at variables your own code references, so variables read by bundled Mastra packages (like `AUTO_BLOCK_EXTERNAL_PROVIDERS`) no longer show up as warnings. They are listed as info instead.

**Platform-stored env vars** — `mastra deploy` and `mastra server deploy` preflight now merge the env vars already stored on the target environment / server project under your local env file (local wins, mirroring the platform's deploy-time merge). Vars stored only on the platform no longer trigger `MISSING_ENV_VAR` or `LOCAL_STORAGE_PATH` alarms.

**Platform-injected guards** — storage fallbacks guarded by variables the platform sets automatically (like `MASTRA_STORAGE_URL` on Mastra Cloud) are trusted and never flagged.

These deploys previously required `--skip-preflight` to get through.
