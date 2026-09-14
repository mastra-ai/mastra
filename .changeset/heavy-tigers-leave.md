---
'@mastra/core': minor
'@mastra/server': patch
'@mastra/client-js': patch
---

Add mandatory skill dependencies for tool activation and execution.

Configure `createToolSkillPolicy` once on `Mastra.toolPolicy` (static or resolved per preparation), and enable `trackReadiness` on `SkillSearchProcessor`. Missing instructions return a recoverable dependency error. Per-run hooks cannot bypass the execution check.

```ts
const toolPolicy = createToolSkillPolicy({ generate_image: ['image-generation'] });
const skillSearch = new SkillSearchProcessor({ workspace, trackReadiness: true });
const toolSearch = new ToolSearchProcessor({ tools });
// Pass inputProcessors: [skillSearch, toolSearch] to Agent.
const mastra = new Mastra({ agents: { agent }, toolPolicy });
```

Global policy applies to delegated and late-registered agents and registered direct tools. Native activation and execution checks preserve accepted schema input, cold resume state, and existing skill loading.

Preserve native Controller approval and custom suspension targets when dependencies are unavailable. Add `ToolPolicyError` and retain its recovery fields in native server/client events. Saved declines and cancellation do not require permission to execute a tool.
