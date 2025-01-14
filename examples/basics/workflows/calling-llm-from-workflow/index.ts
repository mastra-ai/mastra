import { Mastra, Step, Workflow } from '@mastra/core';
import { z } from 'zod';

async function main() {
  const newWorkflow = new Workflow({
    name: 'pass message to the workflow',
    triggerSchema: z.object({
      message: z.string(),
    }),
  });

  const replyAsPenguin = new Step({
    id: 'reply',
    outputSchema: z.object({
      reply: z.string(),
    }),
    execute: async ({ context, mastra }) => {
      const penguinCharacter = mastra?.llm?.({
        provider: 'OPEN_AI',
        name: 'gpt-4o',
      });

      const res = await penguinCharacter?.stream(context.machineContext?.triggerData?.message);

      if (!res) {
        return { reply: '' };
      }

      for await (const chunk of res?.textStream) {
        process.stdout.write(chunk);
      }

      const text = await res.text;
      return { reply: text };
    },
  });

  newWorkflow.step(replyAsPenguin);
  newWorkflow.commit();

  const mastra = new Mastra({
    workflows: { newWorkflow },
  });

  const { runId, start } = mastra.getWorkflow('newWorkflow').createRun();

  const result = await start({ triggerData: { message: 'Give me a speech as skipper from penguin of madagascar' } });

  console.log(result.results);
}

main();
