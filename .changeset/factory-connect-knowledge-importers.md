---
'@mastra/factory': minor
---

Added first-class `importers` config on the Factory and a Knowledge Importers settings section in the Factory SPA.

`MastraFactoryConfig` now accepts an `importers` option and an `importersOptions` option. When the platform environment (`MASTRA_PLATFORM_ACCESS_TOKEN` or `MASTRA_PLATFORM_SECRET_KEY` together with `MASTRA_PROJECT_ID`) is present, Factory automatically builds a `Knowledge` instance backed by `importers()` from `@mastra/connect`. The full "user supplies their own `knowledge`" path is unchanged — it always wins when set.

```ts
import { MastraFactory } from '@mastra/factory';

// Platform-enabled deployment — nothing to do:
export const factory = new MastraFactory({ storage /*, ... */ });

// Explicit importers (bypass env auto-detection):
import { importers } from '@mastra/connect';
export const factory2 = new MastraFactory({
  storage,
  importers: importers({ integrations: { notion: { scope: 'org:acme' } } }),
});

// Explicit opt-out:
export const factory3 = new MastraFactory({ storage, importers: false });
```

**Why this matters**

- The presence of a `Knowledge` instance on the Factory — auto-constructed or user-supplied — now drives the `/web/config/features` `knowledge` flag. `MASTRACODE_EXPERIMENTAL_SUBCONSCIOUS=1` still works as a dev override, but is no longer the sole gate.
- `PLATFORM_CONNECT_PROVIDERS` now includes `notion`, `confluence`, `linear`, `zendesk`, and `fireflies` alongside the existing `jira` and `incident-io` entries. Jira stays intake-only — it has no knowledge importer.
- A new Knowledge Importers section on the Factory Settings → Work Intake page lists every knowledge-eligible provider with live connection status and a Connect button. Connecting a provider starts syncing on the next importer tick — no Factory restart.

Auto-construction is silently skipped when the platform environment is absent, so local dev projects boot without needing a platform token.
