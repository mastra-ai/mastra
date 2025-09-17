import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function telephone() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Lets play telephone..\n'));

  const workflow = mastra.getWorkflow('telephoneGame');

  const run = await workflow.createRunAsync();
  const { runId, start } = run;

  // @ts-expect-error
  workflow.watch(async ({ activePaths, context }) => {
    for (const path of activePaths) {
      // @ts-expect-error
      const ctx = context.steps?.[path.stepId]?.status;
      if (ctx === 'suspended') {
        // Handle suspension

        // @ts-expect-error
        if (path.stepId === 'stepC2' && ctx === 'suspended') {
          const confirmed = await confirm({ message: 'Do you want to change the message?' });
          if (confirmed) {
            // @ts-expect-error
            await workflow.resume({
              // @ts-expect-error
              stepId: path.stepId,
              runId,
              context: {
                confirm: true,
              },
            });
          }
        }
      }
    }
  });
  await start();
}
