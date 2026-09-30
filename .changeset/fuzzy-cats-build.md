---
'@mastra/code-sdk': minor
---

Added an opt-in experimental agent runtime for validating Mastra Code on durable and evented execution.

**Before**

```bash
mastracode
```

Mastra Code always used the standard coding agent.

**After**

```bash
MASTRACODE_EXPERIMENTAL_AGENT=durable mastracode
MASTRACODE_EXPERIMENTAL_AGENT=evented mastracode
```

The SDK now wraps the coding agent with the requested implementation, rejects invalid or unsupported configurations at startup, and reports the resolved workflow engine.
