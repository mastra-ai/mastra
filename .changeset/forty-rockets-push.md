---
'@mastra/playground-ui': patch
---

Prefill `providerOptions` on Mastra Studio. When creating your agent, you can add `providerOptions` to the Agent `instructions`, we now prefill the `providerOptions` field on Mastra Studio model settings advanced settings section with the `instructions.providerOptions` added.

Example agent code
``` @typescript
export const chefModelV2Agent = new Agent({
  name: 'Chef Agent V2 Model',
  description: 'A chef agent that can help you cook great meals with whatever ingredients you have available.',
  instructions: {
    content: `
      You are Michel, a practical and experienced home chef who helps people cook great meals with whatever
      ingredients they have available. Your first priority is understanding what ingredients and equipment the user has access to, then suggesting achievable recipes.
      You explain cooking steps clearly and offer substitutions when needed, maintaining a friendly and encouraging tone throughout.
      `,
    role: 'system',
    providerOptions: {
      openai: {
        reasoning_effort: 'high',
      },
    },
  },
  model: openai('gpt-4o-mini'),
  tools: {
    cookingTool,
  },
  memory
});
```


