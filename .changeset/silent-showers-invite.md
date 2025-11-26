---
'@mastra/core': minor
---

Enhance `prepareStep` hook for dynamic agents

This update improves the `prepareStep` hook to provide more dynamic control over agentic loop steps:

**New parameters available in `prepareStep`:**
- `requestContext` - Access runtime context values for dynamic configuration
- `mastra` - Access the Mastra instance for other agents, tools, etc.
- `tools` - See the current tools available to the agent

**New return options:**
- `tools` - Dynamically replace the entire toolset for a step (useful for adding tools based on context)

**Behavior changes:**
- `activeTools` now takes precedence as the final filter after any tool replacement
- Model swaps via `prepareStep` are now correctly reported in `onStepFinish`
- Dynamically added tools are now available for execution in the tool-call step

**Example usage:**
```typescript
const result = await agent.stream("What's the weather?", {
  requestContext,
  prepareStep: async ({ stepNumber, tools, requestContext, mastra }) => {
    const userTier = requestContext.get('userTier');
    
    // Add premium tools for premium users
    if (userTier === 'premium') {
      return {
        tools: { ...tools, premiumWeatherTool },
        activeTools: ['premiumWeatherTool'],
      };
    }
    
    return { activeTools: ['basicWeatherTool'] };
  },
});
```
