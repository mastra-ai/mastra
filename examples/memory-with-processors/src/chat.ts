import { randomUUID } from 'crypto';
import Readline from 'readline';
import 'dotenv/config';

import { mastra } from './mastra';

// Get the interviewer agent that uses ToolCallFilter and KeywordFilter
const agent = mastra.getAgent('interviewerAgent');

// Generate a thread ID for this conversation
let threadId = randomUUID();
console.log(`Thread ID: ${threadId}`);

const resourceId = 'DEMO_CANDIDATE_1';

async function logRes(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(`\n👔 Interviewer:`);
  for await (const chunk of res.textStream) {
    process.stdout.write(chunk);
  }
  console.log(`\n\n`);
}

async function main() {
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

  // Start the interview with an initial message
  await logRes(
    await agent.stream(
      [
        {
          role: 'system',
          content: `Interview starting now. Ask the candidate to introduce themselves and their background.`,
        },
      ],
      { resourceId, threadId },
    ),
  );

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

    // Exit command
    if (prompt.toLowerCase() === 'exit' || prompt.toLowerCase() === 'quit') {
      console.log('Ending interview. Thank you!');
      process.exit(0);
    }

    // Process the candidate's response
    await logRes(
      await agent.stream(prompt, {
        threadId,
        resourceId,
      }),
    );
  }
}

main(); 