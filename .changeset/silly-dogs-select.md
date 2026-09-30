---
'mastracode': minor
---

Added an Experimental agent setting for selecting the standard, durable, or evented coding agent runtime.

**Before**

```text
/settings
```

The settings menu did not expose the coding agent runtime.

**After**

```text
/settings → Experimental agent → Off | Durable | Evented
```

The selection is persisted and takes effect after restarting Mastra Code.
