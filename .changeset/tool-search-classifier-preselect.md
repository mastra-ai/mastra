---
'@mastra/core': minor
---

Add classifier-backed tool preselection to `ToolSearchProcessor`

`ToolSearchProcessor` discovery is model-driven: the agent spends a turn calling `search_tools` before it can act, and keyword ranking only works when the model's query wording overlaps the tool description. Set `preselect` to have a classifier pick a group of tools before the first turn, so the agent starts with them already loaded.

```typescript
const toolSearch = new ToolSearchProcessor({
  tools: allTools,
  preselect: {
    classifier: router, // or the id of a classifier registered on Mastra
    question: 'domain',
    tools: {
      github: ['listPullRequests', 'mergePullRequest'],
      deploys: ['getDeployStatus', 'rollbackDeploy'],
      none: [],
    },
  },
})
```

Preselection is additive. It only adds tools, never narrows the catalog, and leaves `search_tools` exposed as the correction path, so a wrong prediction costs a few unused tool definitions instead of making a tool unreachable. It runs once per user message, so a multi-step turn reuses one decision and a follow-up that changes the subject gets a fresh one. Below `minProbability` (default `0.6`) the classifier abstains and the normal flow runs unchanged, and classifier errors fail open.

The mapping from choices to tools is explicit and exhaustive. Criteria describe groups rather than individual tools, so the question stays the same size as the catalog grows.
