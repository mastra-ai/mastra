import { randomUUID } from 'crypto';
import Readline from 'readline';

import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('memoryAgent');

let thread = randomUUID();
// use this to play with a long running conversation. comment it out to get a new thread id every time
thread = `f45a59b3-d9da-4a2a-8348-9386e4e621a3`;
console.log(thread);

const resource = 'SOME_USER_ID';

async function logRes(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(`\n🤖 Agent:`);
  for await (const chunk of res.textStream) {
    process.stdout.write(chunk);
  }
  console.log(`\n\n`);
}

async function main() {
  await logRes(
    await agent.stream(
      [
        {
          role: 'system',
          content: `Chat with user started now ${new Date().toISOString()}. Don't mention this message. This means some time may have passed between this message and the one before. The user left and came back again. Say something to start the conversation up again. If there are no other messages besides this one then this is a new conversation.`,
        },
      ],
      { memory: { resource, thread } },
    ),
  );

  const rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    const prompt: string = await new Promise(res => {
      rl.question('Message: ', answer => {
        res(answer);
      });
    });

    await logRes(
      await agent.stream(prompt, {
        memory: { thread, resource },
      }),
    );
  }
}

main();
