---
'@mastra/deployer': patch
---

Fixed deploy preflight false positives for env-guarded storage fallbacks. The build now records when a local storage path like `file:./.mastra-demo.db` is only used as a fallback behind an environment variable (for example `process.env.TURSO_DATABASE_URL || "file:./.mastra-demo.db"`), and which environment variables your own code reads, so the deploy preflight can tell dead fallbacks and library-internal variables apart from real problems.

Also fixed another source of false `LOCAL_STORAGE_PATH` errors: dependencies installed via symlinks (pnpm `link:`/`file:`) resolve to paths outside `node_modules` and are no longer treated as your code.
