---
'@mastra/factory': major
---

Removed support for `MASTRA_PLATFORM_SECRET_KEY` in the platform-managed GitHub and Linear integrations. Factories deployed on Mastra Platform now use the injected `MASTRA_PLATFORM_ACCESS_TOKEN`.

**Before:** Set `MASTRA_PLATFORM_SECRET_KEY` to enable platform-managed integrations.

**After:** Mastra Platform injects `MASTRA_PLATFORM_ACCESS_TOKEN`. For local development, set it to an organization API token.

```env
MASTRA_PLATFORM_ACCESS_TOKEN=sk_your-api-token
```
