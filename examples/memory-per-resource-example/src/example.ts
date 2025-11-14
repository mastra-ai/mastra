import { maskStreamTags } from '@mastra/core/utils';
import chalk from 'chalk';
import { randomUUID } from 'crypto';
import ora from 'ora';
import Readline from 'readline';

import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('assistantAgent');

// 🆕 EXAMPLE: Per-Resource Working Memory
// This demonstrates how working memory persists across different conversation threads
// for the same user (resourceId), but is separate for different users.

console.log(chalk.bold.blue('\n🆕 Per-Resource Working Memory Example\n'));
console.log(chalk.gray('This example shows how working memory persists across conversation threads'));
console.log(chalk.gray('for the same user, but stays separate for different users.\n'));

// Simulate different users
const USERS = {
  alice: 'user-alice-123',
  bob: 'user-bob-456',
  demo: 'demo-user-789',
};

// Let user choose which user to simulate
console.log(chalk.yellow('Choose a user to simulate:'));
console.log(chalk.cyan('1. Alice (user-alice-123)'));
console.log(chalk.cyan('2. Bob (user-bob-456)'));
console.log(chalk.cyan('3. Demo User (demo-user-789)'));
console.log(chalk.gray('4. Or just press Enter to use a random user\n'));

const rl = Readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const userChoice = await new Promise<string>(resolve => {
  rl.question(chalk.yellow('Enter choice (1-4 or Enter): '), answer => {
    resolve(answer.trim());
  });
});

let resource: string;
let userName: string;

switch (userChoice) {
  case '1':
    resource = USERS.alice;
    userName = 'Alice';
    break;
  case '2':
    resource = USERS.bob;
    userName = 'Bob';
    break;
  case '3':
    resource = USERS.demo;
    userName = 'Demo User';
    break;
  default:
    resource = `user-${randomUUID()}`;
    userName = 'Random User';
}

// Always generate a new thread ID to demonstrate cross-thread persistence
const thread = randomUUID();

console.log(chalk.green(`\n✅ Simulating: ${userName}`));
console.log(chalk.gray(`📧 Resource ID: ${resource}`));
console.log(chalk.gray(`🧵 Thread ID: ${thread}`));
console.log(chalk.bold.yellow('\n💡 TIP: Run this example multiple times with the same user choice'));
console.log(chalk.bold.yellow('   to see how working memory persists across conversation threads!\n'));

async function logResponse(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(chalk.blue('\n🤖 Assistant:'));

  const memorySpinner = ora('💾 Updating memory...');

  // Mask working memory updates with a spinner
  const maskedStream = maskStreamTags(res.textStream, 'working_memory', {
    onStart: () => memorySpinner.start(),
    onEnd: () => {
      if (memorySpinner.isSpinning) {
        memorySpinner.succeed(chalk.green('💾 Memory updated!'));
      }
    },
  });

  for await (const chunk of maskedStream) {
    process.stdout.write(chunk);
  }
  console.log('\n');
}

async function main() {
  // Start the conversation
  await logResponse(
    await agent.stream(
      [
        {
          role: 'system',
          content: `New conversation thread started at ${new Date().toISOString()}. 
        This may be a returning user - check your working memory to see if you know them already.
        If this is a new user, introduce yourself and learn about them.
        If this is a returning user, greet them warmly and reference what you remember!`,
        },
      ],
      { memory: { thread, resource } },
    ),
  );

  // Interactive chat loop
  while (true) {
    const userInput: string = await new Promise(resolve => {
      rl.question(chalk.yellow('\n💬 You: '), answer => {
        resolve(answer);
      });
    });

    if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
      console.log(chalk.gray('\n👋 Goodbye! Run the example again to see memory persistence!\n'));
      break;
    }

    await logResponse(await agent.stream(userInput, { memory: { thread, resource } }));
  }

  rl.close();
}

main().catch(console.error);
