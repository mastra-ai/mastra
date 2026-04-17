---
"@mastra/studio-agent-builder": minor
"@mastra/core": minor
"@mastra/server": minor
"@mastra/client-js": minor
"@mastra/playground": minor
---

Introduce Agent Builder (Enterprise) — a Studio surface that lets admins expose a simplified, non-engineer UI for building and chatting with dynamic agents.

- New package `@mastra/studio-agent-builder` exporting `MastraAgentBuilder`.
- New `@mastra/core/agent-builder/ee` subpath exporting `IMastraAgentBuilder` and config types.
- `Mastra` accepts an `agentBuilder` option alongside `editor`.
- Server refuses to boot in production when an agent builder is attached without a valid `MASTRA_EE_LICENSE`.
- `/system/packages` reports `agentBuilderEnabled` and `agentBuilderConfig` for UI discovery.
- Playground gains an Agent Studio sidebar (Agents recents, Marketplace, Configure) rendered when the feature is enabled, plus an admin "View as end-user" toggle in the user menu.
- `useCanCreateAgent` continues to honor the legacy `MASTRA_EXPERIMENTAL_UI` flag and is now also satisfied by the Agent Builder feature + `stored-agents:write`.

```ts
import { Mastra } from "@mastra/core";
import { MastraAgentBuilder } from "@mastra/studio-agent-builder";

export const mastra = new Mastra({
  agentBuilder: new MastraAgentBuilder({
    recents: { maxItems: 5 },
  }),
});
```
