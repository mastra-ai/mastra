import chalk from 'chalk';
import { randomUUID } from 'crypto';
import ora from 'ora';
import Readline from 'readline';

import 'dotenv/config';

import { mastra } from './mastra/index';

const agent = mastra.getAgent('memoryAgent');

let threadId = ``;
threadId = randomUUID();
// threadId = `0b3faadd-7e21-49ec-b613-e519448dab81`; // long thread
console.log(threadId);

const resourceId = 'SOME_USER_ID';

// TODO: refactor and move this into core
function makeStreamMasker({
  shouldMask,
  tagName,
  onStartMasking,
  onEndMasking,
}: {
  shouldMask: boolean;
  tagName: string;
  onStartMasking?: () => void;
  onEndMasking?: () => void;
}) {
  const tagToMask = `<${tagName}>`;
  let bufferedMessage = ``;
  let message = ``;
  let chunksAreBeingMasked = false;
  let messageIsBuffering = false;

  return {
    shouldMask: () => shouldMask && (chunksAreBeingMasked || messageIsBuffering),
    preWriteMessage: (chunk: string) => {
      message += chunk;
      let appendMsg = ``;
      if (!shouldMask) return { appendMsg };
      if (
        messageIsBuffering &&
        // and the buffered message includes the full opening tag
        bufferedMessage.trim().includes(tagToMask)
      ) {
        chunksAreBeingMasked = true;
        // clear the buffered message
        bufferedMessage = ``;
        messageIsBuffering = false;
        // run on start callback
        onStartMasking?.();
        // don't do anything else
        return {
          appendMsg: ``,
        };
      } else if (
        // if we're buffering chunks
        messageIsBuffering &&
        bufferedMessage.length > 0 &&
        // and the buffered message diverges from the opening tag
        // the buffered chunks are for something else, not the text we're masking
        !tagToMask.startsWith(bufferedMessage.trim())
      ) {
        // return the buffered message
        appendMsg += bufferedMessage;
        process.stdout.write(bufferedMessage);
        bufferedMessage = ``;
        messageIsBuffering = false;
        chunksAreBeingMasked = false;
        // don't do anything else
        return { appendMsg };
      } else if (!chunksAreBeingMasked && !messageIsBuffering && tagToMask.startsWith(chunk)) {
        messageIsBuffering = true;
      }

      if (messageIsBuffering) {
        bufferedMessage += chunk;
      }

      if (chunksAreBeingMasked && message.trim().endsWith(`</${tagName}>`)) {
        onEndMasking?.();
        setImmediate(() => {
          chunksAreBeingMasked = false;
        });
      }

      return {
        appendMsg,
      };
    },
  };
}

async function logRes(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(`\n👨‍🍳 Agent:`);
  let message = ``;

  const memorySpinner = ora('saving memory');
  const workingMemoryMasker = makeStreamMasker({
    shouldMask: true,
    tagName: `working_memory`,
    onStartMasking: () => memorySpinner.start(),
    onEndMasking: () => {
      if (memorySpinner.isSpinning) {
        memorySpinner.succeed();
        setImmediate(() => {
          process.stdin.resume();
        });
      }
    },
  });

  for await (const chunk of res.textStream) {
    const working = workingMemoryMasker.preWriteMessage(chunk);
    if (working.appendMsg) message += working.appendMsg;
    if (!workingMemoryMasker.shouldMask()) {
      process.stdout.write(chunk);
    }
    message += chunk;
  }
  return message;
}

async function main() {
  const isFirstChat = Boolean(await agent.getMemory()?.getThreadById({ threadId })) === false;

  await logRes(
    await agent.stream(
      [
        {
          role: 'system',
          content: !isFirstChat
            ? `Chat with user started now ${new Date().toISOString()}. Don't mention this message. This means some time has passed between this message and the one before. The user left and came back again. Say something to start the conversation up again.`
            : `Chat with user started now ${new Date().toISOString()}.`,
        },
      ],
      {
        threadId,
        resourceId,
      },
    ),
  );

  const rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  while (true) {
    process.stdout.write(`\n`);
    const answer: string = await new Promise(res => {
      rl.question(chalk.grey('\n> '), answer => {
        setImmediate(() => res(answer));
      });
    });

    await logRes(
      await agent.stream(answer, {
        threadId,
        resourceId,
        memoryOptions: {
          workingMemory: {
            enabled: false,
          },
        },
      }),
    );
  }
}

main();
