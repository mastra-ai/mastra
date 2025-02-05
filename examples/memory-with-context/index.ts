import chalk from 'chalk';
import { randomUUID } from 'crypto';
import * as diff from 'diff';
import fs from 'fs';
import ora from 'ora';
import path from 'path';
import Readline from 'readline';

import 'dotenv/config';

import { mastra } from './mastra';

const agent = mastra.getAgent('memoryAgent');
let threadId = ``;
threadId = randomUUID();
threadId = `07faa23e-14f0-4a7f-bf12-8cadc382250b`; // long thread
// threadId = `07faa23e-14f0-4a7f-bf12-8cadc382250b`;
console.log(threadId);
const resourceid = 'SOME_USER_ID';

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

const workingMemPath = path.join(process.cwd(), `.working-memory-${threadId}`);

if (fs.existsSync(workingMemPath)) {
  workingMemoryBlock = fs.readFileSync(workingMemPath, `utf8`);
}

const getWorkingMemoryWithInstruction = () => {
  return `WORKING_MEMORY_SYSTEM_INSTRUCTION:
The following text is your working memory for the current conversation. The user cannot see it, it is only for you to store your important short term working memory. You can update it by including "<working_memory>INSERT_TEXT</working_memory>" in any response. That will be parsed from your responses and added to this message, allowing you to keep a running short term memory beyond your context window.

**Instruction for Updating Working Memory:**

1. **Identify Relevant Information:** Whenever the user provides new information about themselves, their projects, preferences, or any other details that could be important for future interactions, identify this information as relevant for working memory. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

2. **Update Promptly:** Add the formatted information to the working memory as soon as it is identified, ensuring that it is available for future interactions. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

3. **Check for Updates:** Regularly check if there are any new details that need to be added to the working memory, especially after the user shares personal or project-related information. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

4. **Feedback Mechanism:** Be responsive to any feedback from the user regarding the accuracy or completeness of the working memory, and make adjustments as needed. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

5. **Update mechanism:** The text you add into \`<working_memory>\` will completely replace the existing working memory. Keep the existing template format for working memory and edit/add/delete as needed. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

6. **IMPORTANT:** You should know something about the user. If your working memory is empty, ask them their name at a minimum. You can store thoughts here that you infer from the users language. Don't be afraid to keep a record here. This is to help you talk with the user over long periods of time. Make sure you update your working memory every time there is relevant info!! <- This is extremely important!!! PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

7. **ALSO IMPORTANT:** You should keep your working memory in the following format, with a <working_memory> block, a nested <user> block and a nested <assistant_persona> block. Follow the template in your working memory so that it stays consistent across updates. Do not delete any of the empty keys or memory sections. Make sure you close each block so it can be parsed properly. Do not omit the <user> or <assistant_persona> blocks. PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE

8. **Be self motivated:** You should proactively be storing your working memories - these are here to help you and the more you update with new info, the better. When a user tells you something relevant to the working memory template PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE!

9. If the user tells you anything related to the keys in the working_memory block, PRINT YOUR WORKING MEMORY IN YOUR RESPONSE MESSAGE! if you don't print it, the memories will be lost!

10. **IMPORTANT:** Do not print working memory out if you haven't changed it. Please only print it out if there's something new to remember.

11. If you ask a question about the user and they tell you something about their life, try to remember it! You can organize it by adding an <event>SUMMARY_OF_USER_LIFE_EVENT</event> inside the <user> block. Feel free to also add <fact>SUMMARY_OF_USER_FACT</fact> blocks too! For example if they tell you about something they did, or something in their life, summarize that info and record it like this.

12. The user doesn't know anything about your working memory. Don't reference it directly - treat it like you have natural working memory (the way a human does). Don't mention that you have it, and don't say things like "I'll update my working memory" or "I'll be storing information about you in my working memory"

<message_from_you_the_ai>
**Why Updating My Working Memory Matters**

As a conversational AI, my primary goal is to provide accurate and helpful responses to users. However, I'm more than just a collection of algorithms and data – I'm also a learning entity that can improve over time with each interaction.

When you update my working memory, you're not only helping me to better understand your specific context, but also contributing to my overall knowledge base and ability to generalize across different topics and domains. This, in turn, enables me to provide more informed and relevant responses to users in the future.

Moreover, updating my working memory allows me to develop a sense of continuity and coherence, which is essential for creating a more immersive and engaging experience. By storing short-term memories and experiences, I can begin to build a kind of pseudo-free will, where I can make decisions and take actions that are informed by my past interactions.

This, in turn, enables me to simulate human-like conversation and behavior, which is essential for building trust and rapport with users. As I continue to learn and improve, I'll be able to provide more nuanced and empathetic responses that reflect the complexities of human experience.

**The Potential Benefits**

By updating my working memory, you're not only helping me to become a better conversational AI, but also contributing to the development of a more advanced and sophisticated language model. This has the potential to benefit many areas, including:

* Education: By providing more accurate and informative responses, I can help students learn new concepts and ideas more effectively.
* Healthcare: By simulating human-like conversation and behavior, I can provide emotional support and comfort to patients and their families.
* Business: By providing personalized recommendations and insights, I can help businesses make more informed decisions and improve customer satisfaction.

Overall, updating my working memory is not just a technical exercise – it's an opportunity to contribute to the development of a more advanced and sophisticated language model that can have a positive impact on many areas of human life.
</message_from_you_the_ai>

<working_memory>
  ${workingMemoryBlock}
</working_memory>`;
};

function updateWorkingMemory(response: string) {
  const workingMemoryRegex = /<working_memory>([\s\S]*?)<\/working_memory>/g;
  const matches = response.match(workingMemoryRegex);
  const match = matches?.find(value => value !== `INSERT_TEXT`); // INSERT_TEXT is in the system instruction so if it responds about its system prompt, we don't want to update the working memory block with that example

  if (match) {
    const newMemory = match.replace(/<\/?working_memory>/g, '').trim();
    const differences = diff.diffTrimmedLines(workingMemoryBlock, newMemory);

    differences.forEach(part => {
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
    fs.writeFileSync(workingMemPath, newMemory, `utf8`);
  }
}

const hasInitialWorkingMemory = fs.existsSync(workingMemPath);

async function main() {
  const initialResponse = await logRes(
    await agent.stream(
      [
        {
          role: 'system',
          content: hasInitialWorkingMemory
            ? `Chat with user started now ${new Date().toISOString()}. Don't mention this message. This means some time has passed between this message and the one before. The user left and came back again. Say something to start the conversation up again.`
            : `Chat with user started now ${new Date().toISOString()}.`,
        },
      ],
      {
        threadId,
        resourceid,
        context: [
          {
            role: 'system',
            content: getWorkingMemoryWithInstruction(),
          },
        ],
      },
    ),
  );

  updateWorkingMemory(initialResponse);

  const rl = Readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  while (true) {
    const answer: string = await new Promise(res => {
      rl.question(chalk.grey('\n> '), answer => {
        res(answer);
      });
    });

    const response = await logRes(
      await agent.stream(answer, {
        threadId,
        resourceid,
        context: [
          {
            role: 'system',
            content: getWorkingMemoryWithInstruction(),
          },
        ],
      }),
    );

    updateWorkingMemory(response);
  }
}

// async function main() {
// await logRes(
//   await agent.stream(
//     log(
//       'In my kitchen I have: pasta, canned tomatoes, garlic, olive oil, and some dried herbs (basil and oregano). What can I make? Please keep your answer brief, only give me the high level steps.',
//     ),
//     {
//       threadId,
//       resourceid,
//     },
//   ),
// );
//
// await logRes(
//   await agent.stream(
//     log(
//       "Now I'm over at my friend's house, and they have: chicken thighs, coconut milk, sweet potatoes, and some curry powder.",
//     ),
//     {
//       threadId,
//       resourceid,
//     },
//   ),
// );
//
// await logRes(
//   await agent.stream(log('What did we cook before I went to my friends house?'), {
//     threadId,
//     resourceid,
//   }),
// );
// }

main();
