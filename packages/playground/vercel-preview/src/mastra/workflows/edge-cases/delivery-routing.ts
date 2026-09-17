import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';

export const deliveryInputSchema = z.object({
  channel: z.enum(['email', 'sms', 'all', 'none']).default('all'),
  message: z.string().min(1).max(500).default('A local delivery preview. No message is sent.'),
});

const deliverySchema = z.object({ channel: z.string(), message: z.string() });

function simulateDelivery(channel: string) {
  return createStep({
    id: `simulate-${channel}`,
    description: `Return the ${channel} delivery locally without sending anything.`,
    inputSchema: deliveryInputSchema,
    outputSchema: deliverySchema,
    execute: async ({ inputData }) => ({ channel, message: inputData.message }),
  });
}

export const deliveryRouting = createWorkflow({
  id: 'delivery-routing',
  description: 'Three conditional paths. Select all, one, or none to inspect matching and skipped branches.',
  inputSchema: deliveryInputSchema,
  outputSchema: z.object({ deliveries: z.array(deliverySchema) }),
})
  .branch([
    [async ({ inputData }) => ['email', 'all'].includes(inputData.channel), simulateDelivery('email')],
    [async ({ inputData }) => ['sms', 'all'].includes(inputData.channel), simulateDelivery('sms')],
    [
      async ({ inputData }) => {
        const sendsToAllChannels = inputData.channel === 'all';
        return sendsToAllChannels && inputData.message.trim().length > 0;
      },
      simulateDelivery('audit'),
    ],
  ])
  .map(async ({ inputData }) => ({ deliveries: Object.values(inputData).filter(delivery => delivery !== undefined) }))
  .commit();
