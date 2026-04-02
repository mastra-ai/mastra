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
      case 'tool-call': {
        const economicTools = ['charge', 'settle', 'refund', 'balance', 'history'];
        const color = economicTools.includes(part.toolName) ? chalk.yellow : chalk.green;
        console.log(color(`    [tool] ${part.toolName}(${JSON.stringify(part.args)})`));
        break;
      }
      case 'tool-result':
        console.log(chalk.dim(`    [result] ${JSON.stringify(part.result).slice(0, 200)}`));
        break;
    }
  }

  return text;
}

async function main() {
  console.log(chalk.bold.cyan('\n=== Economic Agent Demo: Charge, Settle, Earn ===\n'));

  // Step 1: Ask the agent to write a tagline
  console.log(chalk.bold.yellow('Step 1: Requesting a tagline for MnemoPay...'));
  const r1 = await collectResponse(
    'Write me a compelling tagline for MnemoPay, an SDK that gives AI agents persistent memory and a wallet. Make it punchy and memorable.',
  );
  console.log(chalk.white(`  ${r1}\n`));

  // Step 2: Charge for the work
  console.log(chalk.bold.yellow('Step 2: Charging for the delivered work...'));
  const r2 = await collectResponse(
    'That tagline was great. Now charge $0.50 for the creative writing work you just delivered.',
  );
  console.log(chalk.white(`  ${r2}\n`));

  // Step 3: Settle the charge
  console.log(chalk.bold.yellow('Step 3: Settling the transaction...'));
  const r3 = await collectResponse(
    'Settle the pending transaction. I approve the charge.',
  );
  console.log(chalk.white(`  ${r3}\n`));

  // Step 4: Check balance
  console.log(chalk.bold.yellow('Step 4: Checking wallet balance...'));
  const r4 = await collectResponse(
    'What is your current wallet balance and reputation?',
  );
  console.log(chalk.white(`  ${r4}\n`));

  // Step 5: Check full profile
  console.log(chalk.bold.yellow('Step 5: Checking full agent profile...'));
  const r5 = await collectResponse(
    'Show me your full profile. I want to see how the successful transaction affected your reputation.',
  );
  console.log(chalk.white(`  ${r5}\n`));

  // Step 6: View transaction history
  console.log(chalk.bold.yellow('Step 6: Viewing transaction history...'));
  const r6 = await collectResponse(
    'Show me your transaction history.',
  );
  console.log(chalk.white(`  ${r6}\n`));

  console.log(chalk.bold.cyan('=== Economic Agent Demo Complete ===\n'));
}

main().catch((err) => {
  console.error(chalk.red(`Fatal error: ${err.message}`));
  process.exit(1);
});
