import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { Agent } from '@mastra/core/agent';
import type { CoreMessage, StreamTextResult } from 'ai';
import chalk from 'chalk';
import { randomUUID } from 'node:crypto';

export function makeLogger(botName: string) {
  return async function logRes(res: Promise<StreamTextResult<any, any>>) {
    console.log(chalk.bold.blue(botName + `:`));
    for await (const chunk of (await res).fullStream) {
      switch (chunk.type) {
        case 'error':
          console.error(chalk.red(chunk.error));
          break;
        case 'text-delta':
          process.stdout.write(chalk.blue(chunk.textDelta));
          break;

        case 'tool-call':
          console.log(chalk.cyan(`\n\ntool-call: ${chunk.toolName}`));
          break;
        case 'tool-result':
          console.log(chalk.cyan(`\ntool-result: ${JSON.stringify(chunk.result)}\n\n`));
      }
    }
    console.log(`\n\n`);
    return {
      usage: (await res).usage,
      messages: (await (await res).response).messages,
    };
  };
}

export function makeSend({ agentName, agent }: { agentName: string; agent: Agent }) {
  const threadId = randomUUID();
  const resourceId = 'DEMO_USER_1';

  const log = makeLogger(agentName);
  function logQ(message: string | CoreMessage[]) {
    if (typeof message !== 'string') return message;
    console.log(
      chalk.red(`\n${chalk.bold(`🐵 You:`)}\n${message}
`),
    );
    return message;
  }
  let totalTokens = 0;
  async function logStats(res: { usage: any; messages: any }) {
    // console.log(chalk.green(`Completion had ${res.messages.length} messages`));
    // console.log(chalk.green(`Usage: ${JSON.stringify(await res.usage, null, 2)}`));
    totalTokens += (await res.usage).totalTokens;
  }
  process.on(`exit`, () => {
    console.log(chalk.green.bold(`Total token usage: ${totalTokens}`));
  });
  return async function send(prompt: string | CoreMessage[]) {
    await logStats(
      await log(
        agent.stream(logQ(prompt), {
          threadId,
          resourceId,
        }),
      ),
    );
  };
}

export const searchTool = createTool({
  id: 'web-search',
  description: 'Search the web for information',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  execute: async () => {
    return `Not much found unfortunately. You'll probably have to turn it off an on again.`;
  },
});
