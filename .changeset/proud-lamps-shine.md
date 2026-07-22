---
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Moved custom model providers and custom model packs off settings.json in the factory web app: both now live in the app database (org-scoped rows in deployed mode, a sentinel local scope in no-auth mode). Custom providers saved in the web settings page are picked up by model resolution and the model catalog through a new pluggable custom-providers source in the SDK, so the gateway no longer reads the host machine's settings.json for them, and models from your custom providers appear in the web model pickers.

Hosts that store custom providers elsewhere (like the factory's database) register a source at boot; when none is registered, the SDK keeps reading settings.json as before:

```ts
import { setCustomProvidersSource } from '@mastra/code-sdk/agents/custom-provider-source';

setCustomProvidersSource(tenant =>
  tenant ? snapshotForOrg(tenant.orgId) : [],
);
```
