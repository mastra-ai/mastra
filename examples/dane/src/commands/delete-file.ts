import { confirm } from '@inquirer/prompts';
import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function deleteFile() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me delete your file..\n'));

  const workflow = mastra.getWorkflow('deleteFile');

  const { runId, start } = await workflow.createRun();

  const res1 = await start();

  console.log(res1);

  console.log('RUN ID', runId);

  await workflow.watch(runId, {
    onTransition: async ({ stepId, context }) => {
      console.log('Tranisitoning', stepId, context.stepResults?.[stepId]?.status);
      if (stepId === 'deletion' && context.stepResults?.[stepId]?.status === 'suspended') {
        const confirmed = await confirm({ message: 'Do you want to delete the file?' });
        if (confirmed) {
          await workflow.resume({
            stepId,
            runId,
            context: {
              confirm: true,
            },
          });
        }
      }
    },
  });
}
