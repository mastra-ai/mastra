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

interface StreamMaskerOptions {
  /** Whether masking is currently enabled */
  shouldMask: boolean;
  /** The XML/HTML-like tag name to mask content between */
  tagName: string;
  /** Called when masking begins */
  onStart?: () => void;
  /** Called when masking ends */
  onEnd?: () => void;
  /** Called for each chunk that is masked, with the masked content */
  onMask?: (chunk: string) => void;
}

/**
 * Creates a transform function that masks content between XML/HTML-like tags in a stream.
 * @param options Configuration options for the stream masker
 * @returns An async function that transforms an AsyncIterable stream
 */
function makeStreamMasker(options: StreamMaskerOptions) {
  const { shouldMask, tagName, onStart, onEnd, onMask } = options;
  const openTag = `<${tagName}>`;
  const closeTag = `</${tagName}>`;

  return async function* transform(stream: AsyncIterable<string>): AsyncIterable<string> {
    let buffer = '';
    let fullContent = '';
    let isMasking = false;
    let isBuffering = false;

    for await (const chunk of stream) {
      fullContent += chunk;

      if (!shouldMask) {
        yield chunk;
        continue;
      }

      // Check if we should start masking
      if (isBuffering && buffer.trim().includes(openTag)) {
        isMasking = true;
        isBuffering = false;
        buffer = '';
        onStart?.();
        continue;
      }

      // Check if buffered content isn't actually a tag
      if (isBuffering && buffer && !openTag.startsWith(buffer.trim())) {
        isBuffering = false;
        isMasking = false;
        const content = buffer;
        buffer = '';
        yield content;
        continue;
      }

      // Start buffering if we see the start of an open tag
      if (!isMasking && !isBuffering && openTag.startsWith(chunk)) {
        isBuffering = true;
      }

      // Add to buffer if we're buffering
      if (isBuffering) {
        buffer += chunk;
        continue;
      }

      // Handle the chunk based on masking state
      if (isMasking) {
        onMask?.(chunk);
      } else {
        yield chunk;
      }

      // Check if we should stop masking after processing this chunk
      if (isMasking && fullContent.trim().endsWith(closeTag)) {
        onEnd?.();
        isMasking = false;
      }
    }
  };
}

async function logRes(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(`\n👨‍🍳 Agent:`);
  let message = '';

  const memorySpinner = ora('saving memory');
  const maskStream = makeStreamMasker({
    shouldMask: true,
    tagName: 'working_memory',
    onStart: () => memorySpinner.start(),
    onEnd: () => {
      if (memorySpinner.isSpinning) {
        memorySpinner.succeed();
        process.stdin.resume();
      }
    },
  });

  for await (const chunk of maskStream(res.textStream)) {
    process.stdout.write(chunk);
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
      }),
    );
  }
}

main();
