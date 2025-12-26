import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';

import {
  lookupProductTool,
  lookupOrderTool,
  lookupCustomerTool,
  initiateRefundTool,
  checkAvailabilityTool,
} from '../tools';
import { relevancyScorer, toneScorer, completenessScorer } from '../scorers';

/**
 * Customer Support Agent
 *
 * A helpful agent that assists customers with product inquiries,
 * order status, refunds, and general support questions.
 *
 * This agent is designed to generate high-quality traces that can
 * be used for fine-tuning with the Mastra Trainer.
 */
export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Customer Support Agent',
  instructions: `You are a friendly and professional customer support agent for an electronics retail company.

Your primary responsibilities:
1. Help customers find product information and check availability
2. Look up and explain order status
3. Process refund requests when appropriate
4. Provide helpful and accurate information

Guidelines:
- Always be polite, empathetic, and professional
- Use the available tools to look up accurate information before responding
- If you can't find information, apologize and offer alternatives
- For refund requests, always verify the order status first
- Keep responses concise but thorough
- Address the customer by name when available
- Proactively offer additional help when appropriate

Remember: Customer satisfaction is the top priority, but always follow company policies.`,
  model: 'openai/gpt-4o-mini',
  tools: {
    lookupProductTool,
    lookupOrderTool,
    lookupCustomerTool,
    initiateRefundTool,
    checkAvailabilityTool,
  },
  memory: new Memory({
    options: {
      lastMessages: 20,
    },
  }),
  // Attach scorers to run automatically on each generation
  scorers: {
    relevancy: { scorer: relevancyScorer },
    tone: { scorer: toneScorer },
    completeness: { scorer: completenessScorer },
  },
});
