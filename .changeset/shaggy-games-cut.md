---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/react': patch
'@mastra/inngest': patch
'@mastra/server': patch
---

Added first-class declarative `agent`, `tool`, and `mapping` workflow steps.

Workflows now represent agents, tools, and `.map()` transforms as explicit step-graph entries (`agent` / `tool` / `mapping`) instead of collapsing them into opaque generic steps. Each entry carries its semantic parameters (agent id + options, tool id + options, mapping config or function) and is interpreted by the engine at execution time. This makes workflow graphs easier to introspect and render, and is consistent with how `loop`, `conditional`, and `sleep` already work.

**New builder methods**

You can now add agents and tools with dedicated builders, with a separate step id distinct from the agent/tool id, and full output-type inference:

```ts
// Before: agents/tools were wrapped via createStep and lost their identity in the graph
workflow.then(createStep(myAgent)).then(createStep(myTool));

// After: dedicated builders (the createStep form still works too)
workflow
  .agent(myAgent) // output inferred as { text: string }
  .agent(myAgent, { structuredOutput: { schema } }) // output inferred from the schema
  .tool(myTool) // output inferred from the tool's outputSchema
  .agent(myAgent, undefined, { id: 'reviewer' }); // reuse the same agent under a distinct step id
```

You can also reference a registered agent or tool by id:

```ts
workflow.agent('my-registered-agent');
```

**Backward compatible**

Existing `.then(createStep(agent))`, `.then(createStep(tool))`, `.map()`, `.parallel()`, and `.branch()` usages keep working and now emit the new declarative entries automatically.
