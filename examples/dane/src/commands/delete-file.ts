import chalk from 'chalk';

import { mastra } from '../mastra/index.js';

export async function deleteFile() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me delete your file..\n'));

  const workflow = mastra.getWorkflow('deleteFile');

  try {
    const result = await workflow.execute({
      onStep: step => {
        console.log(step);
        // if suspended
        // do something
        // call resume
      },
    });

    console.log(result);

    // watch the workflow, if stepResults X are certain status im gonna do something
    // inquirer on the cli
    // resume the state machine with the input from the user

    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.log(e);
  }
}
