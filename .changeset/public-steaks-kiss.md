---
'@mastra/deployer': patch
---

Fixed Studio playground browser telemetry not respecting `MASTRA_TELEMETRY_DISABLED`. The dev server was hardcoding an empty value into the served `index.html`, so the playground React app always initialized PostHog regardless of the env var. The dev server now propagates `process.env.MASTRA_TELEMETRY_DISABLED` to the browser, and any truthy value disables playground analytics.

**Before:** Setting `MASTRA_TELEMETRY_DISABLED=true` in `.env` had no effect on playground network requests to PostHog.

**After:**

```bash
# .env
MASTRA_TELEMETRY_DISABLED=true
```

Playground analytics are now disabled.
