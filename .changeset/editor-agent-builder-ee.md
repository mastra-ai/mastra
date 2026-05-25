---
'@mastra/editor': minor
---

Ship `EditorAgentBuilder` and Agent Builder runtime through the `@mastra/editor/ee` subpath.

- Adds `EditorAgentBuilder` class and supporting types under `@mastra/editor/ee` (dormant unless `MastraEditorConfig.builder` is configured).
- Wires builder resolution on `MastraEditor`: `hasEnabledBuilderConfig()`, `resolveBuilder()`, `ensureBuilderWorkspaces()`, and `reconcileBuilderWorkspaces()`.
- Adds builder defaults plumbing in the agent namespace (`applyBuilderDefaults`, `BUILDER_BASELINE_DEFAULTS` enabling `observationalMemory: true` by default for Builder-created agents).
- Adds a defense-in-depth license guard inside `MastraEditor.resolveBuilder()` that mirrors the server-startup check in `MastraServer.validateAgentBuilderLicense()`. Dev environments bypass via `isEEEnabled()`; production without a valid `MASTRA_EE_LICENSE` throws `[mastra/auth-ee] Agent Builder is configured but no valid EE license was found.`
- Bumps the `@mastra/core` peer dependency to `>=1.34.0-0 <2.0.0-0` to cover the `@mastra/core/agent-builder/ee` and `@mastra/core/auth/ee` subpaths consumed by the builder runtime.

Opt-in usage:

```ts
import { Mastra } from '@mastra/core';
import { MastraEditor } from '@mastra/editor';

const editor = new MastraEditor({
  builder: {
    enabled: true,
    configuration: {
      agent: {
        models: { default: { provider: 'openai', modelId: 'gpt-4o-mini' } },
      },
    },
  },
});

new Mastra({ storage, editor });

// Later, on demand:
const builder = await editor.resolveBuilder();
// `builder` is undefined when the builder is not configured/enabled.
// In production it requires a valid MASTRA_EE_LICENSE; dev environments bypass.
```

This is plumbing — no UI consumer ships in this release.
