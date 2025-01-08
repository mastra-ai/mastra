import { confirm, input } from '@inquirer/prompts';
import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function deleteFile() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me delete your file..\n'));

  const workflow = mastra.getWorkflow('deleteFile');

  try {
    const result = await workflow.execute({
      onStep: async ({ stepId, status, runId }) => {
        console.log('STEP', stepId, status, runId);
        // if (stepId === 'deletion' && status === 'suspended') {
        //   await workflow.resume({
        //     stepId: `deletion`,
        //     runId: runId,
        //     context: {
        //       confirm: true,
        //     },
        //   });
        // }
      },
    });

    console.log(result);

    if (result.results.deletion?.status === 'suspended') {
      console.log('Resuming...');
      const result2 = await workflow.resume({
        stepId: `deletion`,
        runId: result.runId,
        context: {
          confirm: true,
        },
      });

      console.log('RESULT', result2);
    }
  } catch (e) {
    console.log(e);
  }
}
