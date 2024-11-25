import chalk from 'chalk';
import { ExecaError } from 'execa';
import fs from 'fs';
import inquirer from 'inquirer';
import path from 'path';

import { toCamelCase } from '../../utils.js';

export async function createNewAgent() {
  try {
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What is the name of your agent?',
        validate: (input: string) => {
          if (input.trim() === '') {
            return 'Name cannot be empty';
          }
          return true;
        },
      },
      {
        type: 'input',
        name: 'instructions',
        message: 'Provide a prompt for your agent:',
        validate: (input: string) => {
          if (input.trim() === '') {
            return 'Prompt cannot be empty';
          }
          return true;
        },
      },
    ]);

    const agentCode = `
export const ${toCamelCase(answers.name)} = new Agent({
  name: "${toCamelCase(answers.name)}",
  instructions: "${answers.instructions}",
  model: {
    provider: 'ANTHROPIC',
    name: 'claude-3-5-sonnet-20240620',
    toolChoice: 'auto',
  },
});
`;

    // Ensure the mastra/agents directory exists
    const agentsDir = path.join(process.cwd(), 'src', 'mastra', 'agents');
    if (!fs.existsSync(agentsDir)) {
      fs.mkdirSync(agentsDir, { recursive: true });
    }

    const indexPath = path.join(agentsDir, 'agent.ts');

    // If file doesn't exist, create it with initial content
    if (!fs.existsSync(indexPath)) {
      fs.writeFileSync(indexPath, '// Mastra Agents\n\n');
    }

    // Append the new agent to the file
    fs.appendFileSync(indexPath, agentCode);

    console.log(chalk.green(`\n✓ Agent: ${toCamelCase(answers.name)} created successfully!`));
    console.log(chalk.blue(`To use: add the agent to index.ts file`));

    return toCamelCase(answers.name);
  } catch (error) {
    if (error instanceof ExecaError) {
      if (error.isCanceled) {
        console.log(chalk.yellow('\nOperation cancelled'));
        process.exit(0);
      }
    } else if (error instanceof Error && error.name === 'ExitPromptError') {
      console.log(chalk.yellow('\nPrompt cancelled'));
      process.exit(0);
    } else if (error instanceof Error) {
      console.error(chalk.red('Error creating agent:'), error.message);
    } else {
      console.error(chalk.red('Error creating agent:'), error);
    }
  }
}
