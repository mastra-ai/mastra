import chalk from 'chalk';
import * as readline from 'readline';

import { mastra } from './mastra';

const agent = mastra.getAgent('economicMemoryAgent');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(chalk.bold.cyan('\n=== MnemoPay + Mastra: Economic Memory Agent ===\n'));
console.log(chalk.white('This agent has persistent memory and an economic system.'));
console.log(chalk.white('It can remember facts, charge for valuable work, and build reputation.\n'));
console.log(chalk.dim('Memory tools:   ') + chalk.green('mnemopay_remember, mnemopay_recall, mnemopay_forget, mnemopay_reinforce, mnemopay_consolidate'));
console.log(chalk.dim('Economic tools: ') + chalk.yellow('mnemopay_charge, mnemopay_settle, mnemopay_refund, mnemopay_balance'));
console.log(chalk.dim('Status tools:   ') + chalk.blue('mnemopay_profile, mnemopay_logs, mnemopay_history'));
console.log(chalk.dim('\nType "exit" or "quit" to end the session.\n'));

function prompt() {
  rl.question(chalk.bold.white('You: '), async (input) => {
    const trimmed = input.trim();
    if (!trimmed) {
      prompt();
      return;
    }

    if (trimmed.toLowerCase() === 'exit' || trimmed.toLowerCase() === 'quit') {
      console.log(chalk.dim('\nGoodbye!\n'));
      rl.close();
      process.exit(0);
    }

    try {
      const response = await agent.stream(trimmed);

      process.stdout.write(chalk.bold.cyan('\nAgent: '));

      for await (const part of response.fullStream) {
        switch (part.type) {
          case 'error':
            console.error(chalk.red(`\nError: ${part.error}`));
            break;
          case 'text-delta':
            process.stdout.write(chalk.white(part.textDelta));
            break;
          case 'tool-call': {
            const memoryTools = ['mnemopay_remember', 'mnemopay_recall', 'mnemopay_forget', 'mnemopay_reinforce', 'mnemopay_consolidate'];
            const economicTools = ['mnemopay_charge', 'mnemopay_settle', 'mnemopay_refund', 'mnemopay_balance'];
            const color = memoryTools.includes(part.toolName)
              ? chalk.green
              : economicTools.includes(part.toolName)
                ? chalk.yellow
                : chalk.blue;
            console.log(color(`\n  [tool] ${part.toolName}(${JSON.stringify(part.args)})`));
            break;
          }
          case 'tool-result':
            console.log(chalk.dim(`  [result] ${JSON.stringify(part.result).slice(0, 200)}`));
            break;
        }
      }

      console.log('\n');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(chalk.red(`\nError: ${message}\n`));
    }

    prompt();
  });
}

prompt();
