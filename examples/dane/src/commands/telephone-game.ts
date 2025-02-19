import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function telephone() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Lets play telephone..\n'));

  const workflow = mastra.getWorkflow('telephoneGame');

  const { runId, start } = workflow.createRun();

  workflow.watch(async ({ activePaths, context }) => {
    for (const path of activePaths) {
      const ctx = context.steps?.[path.stepId]?.status;
      if (ctx === 'suspended') {
        // Handle suspension
        if (path.stepId === 'stepC2' && ctx === 'suspended') {
          const confirmed = await confirm({ message: 'Do you want to change the message?' });
          if (confirmed) {
            await workflow.resume({
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
