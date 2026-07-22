---
'@mastra/factory': minor
---

Move the `FactoryIntegration` contract and the OAuth `state` signer into `@mastra/factory`. The integration interface (routes, tools, diagnostics, intake/version-control capabilities, `IntegrationContext`) now lives at `@mastra/factory/integrations/base`, and `createStateSigner`/`StateSigner` at `@mastra/factory/state-signing`, so integrations can be implemented against the package without importing the web host.
