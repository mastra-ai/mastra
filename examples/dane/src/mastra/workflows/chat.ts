import { Step, Workflow } from '@mastra/core';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { z } from 'zod';

import { dane } from '../agents';

export const messageWorkflow = new Workflow({
  name: 'entry',
});

const messageStep = new Step({
  id: 'message-input',
  outputSchema: z.object({
    message: z.string(),
  }),
  execute: async () => {
    const { content } = await inquirer.prompt([
      {
        type: 'input',
        name: 'content',
        message: '\n You:',
        validate: input => input.trim().length > 0 || 'Message cannot be empty',
      },
    ]);

    return { message: content };
  },
});

const messageOutputStep = new Step({
  id: 'message-output',
  outputSchema: z.object({
    message: z.string(),
  }),
  // SHOULD BE ABLE TO ACCESS ALL MASTRA PRIMS FROM EXECTUE
  execute: async props => {
    // is there someway to know what steps are flowing into this one and type their props
    const message = props.context?.machineContext.stepResults?.['message-input']?.payload?.message;
    try {
      const res = await dane.generate(message, {
        stream: true,
        maxSteps: 5,
      });

      console.log(chalk.green(`\nDane: \n`));

      for await (const chunk of res.textStream) {
        process.stdout.write(chalk.green(chunk));
      }

      console.log(chalk.green(`\n`));

      return { message: 'success' };
    } catch (e) {
      console.log(chalk.red(`\n`));
      console.log(chalk.red(`\n`));
      console.log(chalk.red(`Error streaming results. Let's try again.`));
      console.log(chalk.red(e.message));
    }

    const res = await dane.generate(message, {
      maxSteps: 5,
    });

    console.log(chalk.green(res.text));

    return { message: res.text };
  },
});

messageWorkflow
  .step(messageStep)
  .after(messageStep)
  .step(messageOutputStep)
  .after(messageOutputStep)
  .step(messageStep)
  .commit();
