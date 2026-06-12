---
'@mastra/railway': patch
---

Use Railway SDK native `cwd` and `env` exec options (v3.3.1+) instead of manual command wrapping. Removes the `buildSpawnCommand` workaround that composed `cd` and env-prefix into the command string client-side — the SDK now handles this internally via `ExecOptions.cwd` and `ExecOptions.env`.
