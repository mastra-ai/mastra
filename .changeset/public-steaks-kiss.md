---
'@mastra/deployer': patch
---

Fixed Studio playground browser telemetry not respecting `MASTRA_TELEMETRY_DISABLED`. The dev server was hardcoding an empty value into the served `index.html`, so `window.MASTRA_TELEMETRY_DISABLED` was always falsy in the browser and the playground React app initialized PostHog regardless of the user's `.env`. The dev server now propagates `process.env.MASTRA_TELEMETRY_DISABLED` to the browser, where the playground applies the same canonical opt-out parsing as the rest of the framework.

**Before:** Setting `MASTRA_TELEMETRY_DISABLED=true` in `.env` had no effect on playground network requests to PostHog.

**After:**

```bash
# .env
MASTRA_TELEMETRY_DISABLED=true
```

Playground analytics are now disabled.
