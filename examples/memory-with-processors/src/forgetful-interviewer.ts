import 'dotenv/config';

import Readline from 'readline';

import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import type { CoreMessage } from '@mastra/core';
import type { MessageProcessor, SharedMessageProcessorOpts } from '@mastra/core/memory';
import { Memory } from '@mastra/memory';

import { makeSend } from './utils';

// Custom processor that makes the llm forget any messages that contain keywords
class ForgetfulProcessor implements MessageProcessor {
  constructor(private keywords: string[]) {}

  process(messages: CoreMessage[], _opts: SharedMessageProcessorOpts = {}): CoreMessage[] {
    return messages.map(message => {
      if (message.role === `assistant` || message.role === `user`) {
        const content =
          typeof message.content === `string`
            ? message.content
            : message.content.reduce((msg = ``, current) => {
                if (current.type === `text`) {
                  return msg + `\n${current.text}`;
                }
              }, '') || '';

        const shouldForgetThis = this.keywords.some(keyword => content.toLowerCase().includes(keyword.toLowerCase()));
        console.log(`\n`, { shouldForgetThis, content });
        if (shouldForgetThis && (message.role === `user` || message.role === `assistant`)) {
          return {
            role: 'assistant',
            content: `<forgotten>I'm getting forgetful in my old age. this used to be a ${message.role} message but I forgot it</forgotten>`,
          };
        }
      }
      return message;
    });
  }
}

// Interviewer agent that accidentally forgets your name all the time
const agent = new Agent({
  name: 'Forgetful Job Interviewer',
  instructions:
    "You are a professional job interviewer for a technology company. Conduct insightful interviews by asking relevant questions about skills, experience, and problem-solving abilities. Respond to candidate answers and ask follow-up questions. Keep the interview professional and engaging. Remember details the candidate shares earlier in the conversation. Sometimes you forget things by accident. The system will show you if you forgot. Don't be embarassed, you can admit when you forget something, you'll know when you do because there will be a message wrapped in <forgetten> tags. Don't refer to the user by their name, it comes across as too eager",
  model: openai('gpt-4o'),
  memory: new Memory({
    processors: [
      // Custom filter to remove messages with certain keywords
      new ForgetfulProcessor(['name']),
    ],
    options: {
      lastMessages: 30,
      semanticRecall: false,
    },
  }),
});

console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  MASTRA MEMORY PROCESSORS DEMO - CONTENT FILTERING       ║
║                                                          ║
║  This example demonstrates:                              ║
║  1. ToolCallFilter - All tool calls are filtered out     ║
║  2. KeywordFilter - Messages with words like:            ║
║     "confidential", "private", or "sensitive" are        ║
║     filtered out of the conversation history.            ║
║                                                          ║
║  Try including those words in your responses to see      ║
║  how the agent "forgets" that information in later       ║
║  conversation turns.                                     ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);

const send = makeSend({
  agentName: `\n👔 Forgetful interviewer (can never remember your name)`,
  agent,
});

await send([
  {
    role: 'system',
    content: `Interview starting now. Ask the candidate to introduce themselves and their background.`,
  },
]);

const rl = Readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Interactive chat loop
while (true) {
  const prompt: string = await new Promise(res => {
    rl.question('You: ', answer => {
      res(answer);
    });
  });

  if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') {
    console.log('Ending interview. Thank you!');
    process.exit(0);
  }

  await send(prompt);
}
