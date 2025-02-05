import chalk from 'chalk';
import { randomUUID } from 'crypto';
import * as diff from 'diff';
import fs from 'fs';
import ora from 'ora';
import path from 'path';
import Readline from 'readline';

import 'dotenv/config';

import { mastra } from './mastra/index';

const agent = mastra.getAgent('memoryAgent');
let threadId = ``;
threadId = randomUUID();
threadId = `0b3faadd-7e21-49ec-b613-e519448dab81`; // long thread
// threadId = `07faa23e-14f0-4a7f-bf12-8cadc382250b`;
console.log(threadId);
const resourceId = 'SOME_USER_ID';

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
        console.log(`dumping buffered message. ${tagToMask} doesn't include ${bufferedMessage.trim()}`);
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

  const thinkSpinner = ora('thinking');
  const thinkMasker = makeStreamMasker({
    shouldMask: false,
    tagName: `think`,
    onStartMasking: () => thinkSpinner.start(),
    onEndMasking: () => thinkSpinner.succeed(),
  });

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
    const think = thinkMasker.preWriteMessage(chunk);
    const working = workingMemoryMasker.preWriteMessage(chunk);
    if (think.appendMsg) message += think.appendMsg;
    if (working.appendMsg) message += think.appendMsg;
    if (!thinkMasker.shouldMask() && !workingMemoryMasker.shouldMask()) {
      process.stdout.write(chunk);
    }
    message += chunk;
  }
  return message;
}

const workingMemoryTemplate = `<user>
  First name:
  Last name:
  Profession:
  Birth date:
  Age:
  Place of residence:
  Other relevant info:
</user>

<assistant_persona>
  user sentiment towards me:
  my preferences:
  other relevant info:
</assistant_persona>
`;

let workingMemoryBlock = workingMemoryTemplate;

const workingMemPath = path.join(process.cwd(), `.working-memory.txt`);

if (fs.existsSync(workingMemPath)) {
  workingMemoryBlock = fs.readFileSync(workingMemPath, `utf8`);
}

function updateWorkingMemory(response: string) {
  const workingMemoryRegex = /<working_memory>([\s\S]*?)<\/working_memory>/g;
  const matches = response.match(workingMemoryRegex);
  const match = matches?.find(value => value !== `INSERT_TEXT`); // INSERT_TEXT is in the system instruction so if it responds about its system prompt, we don't want to update the working memory block with that example

  if (match) {
    const newMemory = match.replace(/<\/?working_memory>/g, '').trim();
    const differences = diff.diffTrimmedLines(workingMemoryBlock, newMemory);

    differences.forEach((part: any) => {
      if (part.added) {
        console.log(chalk.green('  + ' + part.value.trim()));
      } else if (
        part.removed &&
        !part.value.trimEnd().endsWith('..') &&
        !part.value.trimEnd().endsWith(`:`) &&
        !!part.value.trim()
      ) {
        console.log(chalk.red('  - ' + part.value.trim()));
      }
    });
    workingMemoryBlock = newMemory;
    // console.log(`writing ${workingMemPath}`);
    // fs.writeFileSync(workingMemPath, newMemory, `utf8`);
  }
}

async function main() {
  const previousMessages = await agent.getMemory()?.getThreadById({ threadId });
  const isFirstChat = Boolean(previousMessages) === false;
  console.log({ isFirstChat });
  const initialResponse = await logRes(
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
        memoryOptions: {
          workingMemory: {
            enabled: true,
            path: workingMemPath,
          },
        },
      },
    ),
  );

  // updateWorkingMemory(initialResponse);

  await new Promise(res => setTimeout(res, 500));
  const rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  while (true) {
    process.stdout.write(`\n`);
    await new Promise(res => setImmediate(res));
    const answer: string = await new Promise(res => {
      rl.question(chalk.grey('\n> '), answer => {
        setImmediate(() => res(answer));
      });
    });

    await new Promise(res => setImmediate(res));
    const response = await logRes(
      await agent.stream(answer, {
        threadId,
        resourceId,
        memoryOptions: {
          workingMemory: {
            enabled: true,
            path: workingMemPath,
          },
        },
      }),
    );

    updateWorkingMemory(response);
  }
}

main();
