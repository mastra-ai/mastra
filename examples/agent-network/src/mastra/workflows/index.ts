import { Step, Workflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { webSearchAgent } from '../agents';

export const agentWorkflow = new Workflow({
  name: 'Agent Workflow',
  steps: [webSearchAgent.toStep()],
  triggerSchema: z.object({
    prompt: z.string(),
  }),
});

const nextStep = new Step({
  id: 'nextStep',
  execute: async ({ streamWriter }) => {
    const data = { foo: 'bar' };
    streamWriter?.writeData({ type: 'data', value: data });
    return { executed: true };
  },
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
  .then(nextStep)
  .commit();
