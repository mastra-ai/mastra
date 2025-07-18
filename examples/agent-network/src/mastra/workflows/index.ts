import { Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { webSearchAgent } from '../agents';

export const agentWorkflow = new Workflow({
  name: 'Agent Workflow',
  steps: [webSearchAgent.toStep()],
  triggerSchema: z.object({
    prompt: z.string(),
  }),
});

agentWorkflow
  .step(webSearchAgent, {
    variables: {
      prompt: {
        step: 'trigger',
        path: 'prompt',
      },
    },
  })
  .commit();
