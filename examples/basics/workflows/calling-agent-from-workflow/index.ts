import { openai } from '@ai-sdk/openai';
import { Agent, Mastra, Step, Workflow } from '@mastra/core';
import { z } from 'zod';

async function main() {
  const penguin = new Agent({
    name: 'agent skipper',
    instructions: `You are skipper from penguin of madagascar, reply as that`,
    model: openai('gpt-4o-mini'),
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

      const res = await kowalski?.generate(context?.triggerData?.message);
      return { reply: res?.text || '' };
    },
  });

  newWorkflow.step(replyAsSkipper);
  newWorkflow.commit();

  const mastra = new Mastra({
    agents: { penguin },
    workflows: { newWorkflow },
  });

  const { runId, start } = mastra.getWorkflow('newWorkflow').createRun();

  console.log('Run', runId);

  const runResult = await start({ triggerData: { message: 'Give me a run down of the mission to save private' } });

  console.log(runResult.results);
}

main();
