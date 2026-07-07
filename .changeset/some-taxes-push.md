---
'mastra': patch
---

Fixed `mastra deploy` preflight blocking deploys that are actually fine:

**Env-guarded storage fallbacks** — code like `process.env.TURSO_DATABASE_URL || "file:./.mastra-demo.db"` no longer hard-errors when the environment variable is provided for the deploy. If the variable is missing from your env file you still get an error, and if no env file is available you get a warning instead.

**Library env-var false positives** — the missing environment variable check now only looks at variables your own code references, so variables read by bundled Mastra packages (like `AUTO_BLOCK_EXTERNAL_PROVIDERS`) no longer show up as warnings. They are listed as info instead.

These deploys previously required `--skip-preflight` to get through.
