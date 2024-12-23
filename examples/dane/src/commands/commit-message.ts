import chalk from 'chalk';
import { execSync } from 'child_process';

import { mastra } from '../mastra/index.js';

export async function commitMessageCommand() {
  console.log(chalk.green("Hi! I'm Dane!"));
  console.log(chalk.green('Let me label this for you..\n'));

  try {
    const workflow = mastra.getWorkflow('commitMessage');
    if (!workflow) {
      console.error(chalk.red('Commit message generator workflow not found. Make sure it is properly set up.'));
      process.exit(1);
    }

    // Get the current path
    const currentPath = execSync('pwd', { encoding: 'utf-8' }).trim();

    const result = await workflow.execute({
      triggerData: {
        repoPath: currentPath,
      },
    });

    const generateMessageStep = result.results.generateMessage;
    if (generateMessageStep?.status === 'success' && generateMessageStep.payload.commitMessage) {
      const commitMessage = generateMessageStep.payload.commitMessage;
      console.log(chalk.green('\nGenerated commit message:\n\t', commitMessage));

      // Prompt user to use this commit message
      const useMessage = execSync('read -p "Would you like to use this commit message? (y/N) " choice; echo $choice', {
        encoding: 'utf-8',
        stdio: ['inherit', 'pipe', 'pipe'],
      }).trim();

      if (useMessage.toLowerCase() === 'y') {
        execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
        console.log(chalk.green('Commit created successfully!'));
      } else {
        console.log(chalk.red('Commit message generation cancelled.'));
      }
    } else {
      console.error(chalk.red('Failed to generate commit message.'));
      process.exit(1);
    }
  } catch (error: any) {
    console.error(chalk.red('Error:', error?.message || 'An unknown error occurred'));
    process.exit(1);
  }
}
