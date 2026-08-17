---
'mastracode': minor
---

Added environment-controlled process memory diagnostics and the `/profile` command for the TUI and headless CLI.

Enable diagnostics before startup:

```bash
MASTRACODE_PROFILE=1 mastracode
```

Control the same process-wide run from the TUI:

```text
/profile status
/profile start
/profile capture
/profile stop
```

Diagnostics save private process and V8 samples, garbage collection events, and allocation profiles without forcing garbage collection or writing heap snapshots. Allocation profiles may contain prompts, credentials, file contents, and tool arguments, so keep them private and delete them after analysis.
