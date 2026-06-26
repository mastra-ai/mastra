---
'@mastra/core': minor
'@mastra/server': minor
'@mastra/client-js': minor
---

Rename the `Harness` class to `AgentController` and its associated `Harness*` types to `AgentController*` (e.g. `HarnessConfig` → `AgentControllerConfig`, `HarnessMode` → `AgentControllerMode`, `HarnessEvent` → `AgentControllerEvent`). Both the `Harness` class and all `Harness*` types remain exported from `@mastra/core/harness` as backwards-compatible (deprecated) aliases, so existing `Harness` class and type usage continues to work unchanged. New code should prefer the `AgentController*` names.

A new canonical subpath `@mastra/core/agent-controller` is now available and exports the `AgentController` class plus the `AgentController*` types. The legacy `@mastra/core/harness` subpath remains available and additionally re-exports the deprecated `Harness*` aliases. New code should import from `@mastra/core/agent-controller`.

On `Mastra`, the hosted-controller API is now exposed under agent-controller names — `getAgentController`, `getAgentControllerById`, `listAgentControllers`, and the `agentControllers` config key — while the existing `getHarness`/`getHarnessById`/`listHarnesses` methods and `harnesses` config key remain as deprecated aliases.

The server now serves the controller session API under `/agent-controller/...` (with `agent-controller:read` / `agent-controller:execute` permissions). The legacy `/harness/...` routes remain available for backwards compatibility, mirrored from the canonical agent-controller surface.

The client (`@mastra/client-js`) gains canonical `MastraClient.getAgentController(id)` and `MastraClient.listAgentControllers()` methods (plus the `AgentController` / `AgentControllerSession` resource classes) that target the `/agent-controller` routes. The existing `getHarness` / `listHarnesses` methods and `Harness` / `HarnessSession` classes remain as deprecated aliases that continue to target the legacy `/harness` routes.
