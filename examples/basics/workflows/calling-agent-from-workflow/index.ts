import { Agent, Mastra, Step, Workflow } from '@mastra/core';
import { z } from 'zod';

const penguin = new Agent({
  name: 'agent skipper',
  instructions: `You are skipper from penguin of madagascar, reply as that`,
  model: {
    provider: 'OPEN_AI',
    name: 'gpt-4o',
  },
});

const newWorkflow = new Workflow({
  name: 'pass message to the workflow',
  triggerSchema: z.object({
    message: z.string(),
  }),
});

const replyAsSkipper = new Step({
  id: 'reply',
  outputSchema: z.object({
    reply: z.string(),
  }),
  execute: async ({ context, mastra }) => {
    const kowalski = mastra?.agents?.penguin;

    const res = await kowalski?.generate(context.machineContext?.triggerData?.message);
    return { reply: res?.text || '' };
  },
});

newWorkflow.step(replyAsSkipper);
newWorkflow.commit();

const mastra = new Mastra({
  agents: { penguin },
  workflows: { newWorkflow },
});

const runResult = await mastra
  .getWorkflow('newWorkflow')
  .execute({ triggerData: { message: 'Give me a run down of the mission to save private' } });

console.log(runResult.results);