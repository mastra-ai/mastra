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
- End-user features: starred agents/skills (via a new per-user `user_preferences` storage domain), marketplace visibility toggles (`metadata.visibility: 'private' | 'public'`), and agent avatar uploads (base64, persisted to `metadata.avatarUrl`). Skills gain a non-breaking, additive `metadata` field on the thin record so visibility, stars, and other filters work the same as agents.
- New server routes: `GET` / `PATCH /user/preferences` and `POST /stored/agents/:agentId/avatar`.
- New `configure.allowAgentAvatarUpload`, `marketplace.allowAgentStarring`, `marketplace.allowSkillStarring`, `marketplace.allowAgentSharing`, and `marketplace.allowSkillSharing` config flags (all default to `true`).

```ts
import { Mastra } from "@mastra/core";
import { MastraAgentBuilder } from "@mastra/studio-agent-builder";

export const mastra = new Mastra({
  agentBuilder: new MastraAgentBuilder({
    recents: { maxItems: 5 },
  }),
});
```
