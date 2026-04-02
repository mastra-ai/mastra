import chalk from 'chalk';

import { mastra } from '../mastra';

const agent = mastra.getAgent('economicMemoryAgent');

async function collectResponse(prompt: string): Promise<string> {
  const response = await agent.stream(prompt);
  let text = '';

  for await (const part of response.fullStream) {
    switch (part.type) {
      case 'text-delta':
        text += part.textDelta;
        break;
      case 'tool-call':
        console.log(chalk.green(`    [tool] ${part.toolName}(${JSON.stringify(part.args)})`));
        break;
      case 'tool-result':
        console.log(chalk.dim(`    [result] ${JSON.stringify(part.result).slice(0, 200)}`));
        break;
    }
  }

  return text;
}

async function main() {
  console.log(chalk.bold.cyan('\n=== Memory Demo: Persistent Memory via MCP ===\n'));

  // Step 1: Remember user preferences
  console.log(chalk.bold.yellow('Step 1: Remembering user preferences...'));
  const r1 = await collectResponse(
    'Remember this: The user\'s name is Jerry and he prefers dark mode.',
  );
  console.log(chalk.white(`  ${r1}\n`));

  // Step 2: Remember project context
  console.log(chalk.bold.yellow('Step 2: Remembering project context...'));
  const r2 = await collectResponse(
    'Remember this: Jerry is building MnemoPay, an economic memory SDK for AI agents.',
  );
  console.log(chalk.white(`  ${r2}\n`));

  // Step 3: Remember next milestone
  console.log(chalk.bold.yellow('Step 3: Remembering the next milestone...'));
  const r3 = await collectResponse(
    'Remember this: The next milestone is Mastra integration.',
  );
  console.log(chalk.white(`  ${r3}\n`));

  // Step 4: Recall everything about the user
  console.log(chalk.bold.yellow('Step 4: Recalling everything about the user...'));
  const r4 = await collectResponse(
    'What do you know about the user? Recall all relevant memories first.',
  );
  console.log(chalk.white(`  ${r4}\n`));

  // Step 5: Consolidate memories
  console.log(chalk.bold.yellow('Step 5: Consolidating memories...'));
  const r5 = await collectResponse(
    'Consolidate your memories to prune any stale ones.',
  );
  console.log(chalk.white(`  ${r5}\n`));

  // Step 6: Check profile
  console.log(chalk.bold.yellow('Step 6: Checking agent profile...'));
  const r6 = await collectResponse(
    'Show me your full agent profile.',
  );
  console.log(chalk.white(`  ${r6}\n`));

  console.log(chalk.bold.cyan('=== Memory Demo Complete ===\n'));
}

main().catch((err) => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});
