---
'@mastra/deployer-cloudflare': patch
---

Fixed agent streaming in Cloudflare Workers by updating the default compatibility date from `2025-04-01` to `2025-05-05`, enabling WeakRef and FinalizationRegistry. Fixes [#27899](https://github.com/mastra-ai/mastra/issues/27899).

Before this update, the default used the original `URLPattern` implementation. The new default enables the standard implementation, which may change URL matching. Check your URL patterns after upgrading. To keep the original matching behavior while using the new default date and streaming fix, configure `urlpattern_original` alongside `nodejs_compat`:

```ts
import { CloudflareDeployer } from '@mastra/deployer-cloudflare';

const deployer = new CloudflareDeployer({
  name: 'my-worker',
  compatibility_flags: ['nodejs_compat', 'urlpattern_original'],
});
```

Explicit compatibility dates remain unchanged. If you configured a date before `2025-05-05`, this update does not automatically enable WeakRef or fix streaming; update your configured date to `2025-05-05` or later to receive the fix.
