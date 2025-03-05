import crypto from 'node:crypto';
import { maskStreamTags } from '@mastra/core/utils';
import tinycolor from 'tinycolor2';
import ora from 'ora';
import chalk from 'chalk';
import Readline from 'readline';

import 'dotenv/config.js';

import gradient from 'gradient-string';
import { agent } from './mastra/agents';

type AsyncIterableStream<T> = AsyncIterable<T> & ReadableStream<T>;

function makeThinkStream(textStream: AsyncIterableStream<string>) {
  const thinking = ora({
    text: chalk.bold(`thinking`),
    spinner: {
      interval: 80,
      frames: ['⢎ ', '⠎⠁', '⠊⠑', '⠈⠱', ' ⡱', '⢀⡰', '⢄⡠', '⢆⡀'],
    },
    color: 'green',
  });

  let thought = ``;
  const start = Date.now();
  const grad = gradient(['darkslategray', 'white', 'midnightblue']);

  return maskStreamTags(textStream, 'think', {
    onStart: () => {
      thinking.start();
    },
    onMask: chunk => {
      if (chunk.includes(`think`)) return;
      thought += chunk;
      thought = thought
        .substring(Math.max(0, thought.length - 80))
        .split(`\n`)
        .join(` `);
      thinking.suffixText = grad(thought);
    },
    onEnd: () => {
      thinking.suffixText = grad(thought.substring(Math.max(0, thought.length - 90)));
      thinking.succeed(`thought ${chalk.bold(`for ${Math.ceil((Date.now() - start) / 1000)}s`)}`);
      console.log(`\n${chalk.bold.green(`Fireworks R1:`)}`);
    },
  });
}

const resourceId = 'SOME_USER_ID';
const threadId = crypto.randomUUID();
async function main() {
  console.clear(); // clear all previous output

  while (true) {
    const rl = Readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      history: ["What's the meaning of life?"],
    });
    process.stdout.write(`\n\n`);
    const answer: string = await new Promise(res => {
      rl.question(chalk.grey('\n> '), answer => {
        setImmediate(() => res(answer));
      });
    });
    console.log(); // print a line between prompt and response

    const { textStream } = await agent.stream(answer, {
      threadId,
      resourceId,
    });

    for await (const chunk of makeThinkStream(textStream)) {
      process.stdout.write(chalk.hex(tinycolor('seagreen').toHex())(chunk));
    }
    rl.close();
  }
}

main();
