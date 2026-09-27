import type { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { askOrganizationAgent } from '../agents/organization-agent.js';
import { organizationAnswerSchema } from '../answers/schema.js';

export function createAnswerOrganizationQuestionTool(agent: Agent) {
  return createTool({
    id: 'answer-organization-question',
    description: 'Answers an institutional question from indexed evidence with citations.',
    inputSchema: z.object({ question: z.string() }),
    outputSchema: organizationAnswerSchema,
    execute: async ({ question }) => askOrganizationAgent(agent, question),
  });
}
