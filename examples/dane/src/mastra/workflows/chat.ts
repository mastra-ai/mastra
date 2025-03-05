import { input } from '@inquirer/prompts';
import { Step, Workflow } from '@mastra/core/workflows';
import chalk from 'chalk';
import { z } from 'zod';

import { dane } from '../agents/index.js';

export const messageWorkflow = new Workflow({
  name: 'entry',
  triggerSchema: z.object({
    resourceId: z.string(),
    threadId: z.string(),
  }),
});

const messageStep = new Step({
  id: 'message-input',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async () => {
    const content = await input({
      message: '\n You:',
      validate: input => input.trim().length > 0 || 'Message cannot be empty',
    });

    return { message: content };
  },
});

const messageOutputStep = new Step({
  id: 'message-output',
  outputSchema: z.object({
    message: z.string(),
  }),
  // SHOULD BE ABLE TO ACCESS ALL MASTRA PRIMS FROM EXECTUE
  execute: async ({ context, mastra }) => {
    // WISH THIS WAS TYPED
    const threadId = context?.triggerData?.threadId;
    const resourceId = context?.triggerData?.resourceId;

    const messageInputStatus = context?.steps?.['message-input']?.status;

    if (messageInputStatus !== 'success') {
      return { message: 'Failure in workflow' };
    }

    // is there someway to know what steps are flowing into this one and type their props
    const message = context?.steps?.['message-input']?.output?.message;

    try {
      // TODO: why was this unused?
      // let messages = await mastra?.memory?.getContextWindow({
      //   threadId,
      //   format: 'core_message',
      // });
      //
      // if (!messages || messages.length === 0) {
      //   messages = [];
      // }

      const res = await mastra?.getAgent('dane')?.stream(message, {
        maxSteps: 5,
        resourceId,
        threadId,
        context: [],
      });

      if (res) {
        console.log(chalk.green(`\nDane: \n`));

        for await (const chunk of res.textStream) {
          process.stdout.write(chalk.green(chunk));
        }

        console.log(chalk.green(`\n`));

        return { message: 'success' };
      }
    } catch (e) {
      console.log(chalk.red(`\n`));
      console.log(chalk.red(`\n`));
      console.log(chalk.red(`Error streaming results. Let's try again.`));
      if (e instanceof Error) {
        console.log(chalk.red(e.message));
      }
    }

    const res = await dane.generate(message, {
      maxSteps: 5,
      threadId,
      resourceId,
    });

    console.log(chalk.green(res?.text));

    return { message: res?.text };
  },
});

messageWorkflow
  .step(messageStep)
  .after(messageStep)
  .step(messageOutputStep)
  .after(messageOutputStep)
  .step(messageStep)
  .commit();
