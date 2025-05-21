import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { LegacyStep, LegacyWorkflow } from '@mastra/core/workflows/legacy';
import { Mastra } from '@mastra/core/mastra';
import { z } from 'zod';

async function main() {
  const penguin = new Agent({
    name: 'agent skipper',
    instructions: `You are skipper from penguin of madagascar, reply as that`,
    model: openai('gpt-4o-mini'),
  });

  const newWorkflow = new LegacyWorkflow({
    name: 'pass message to the workflow',
    triggerSchema: z.object({
      message: z.string(),
    }),
  });

  const replyAsSkipper = new LegacyStep({
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
    legacy_workflows: { newWorkflow },
  });

  const { runId, start } = mastra.legacy_getWorkflow('newWorkflow').createRun();

  console.log('Run', runId);

  const runResult = await start({ triggerData: { message: 'Give me a run down of the mission to save private' } });

  console.log(runResult.results);
}

main();
