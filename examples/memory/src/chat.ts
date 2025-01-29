import { randomUUID } from 'crypto';
import Readline from 'readline';

import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('memoryAgent');

let threadId = randomUUID();
// use this to play with a long running conversation. comment it out to get a new thread id every time
threadId = `39873fbf-84d6-425e-8c1b-8afd798d72a4`;
console.log(threadId);

const resourceid = 'SOME_USER_ID';

async function logRes(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(`\n🤖 Agent:`);
  for await (const chunk of res.textStream) {
    process.stdout.write(chunk);
  }
  console.log(`\n\n`);
}

async function main() {
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
        threadId,
        resourceid,
      }),
    );
  }
}

main();
