import { registerApiRoute } from '@mastra/core/server';

export const modelUsageRoute = registerApiRoute('/model-usage', {
  method: 'POST',
  handler: async c => {
    const result = await c.get('mastra').getAgent('usageAgent').generate('hi');
    return c.json({ text: result.text });
  },
});
