import { randomUUID } from 'crypto';
import 'dotenv/config';

import { mastra } from './mastra';

function log(message: string) {
  console.log(`\n>>Question: ${message}
`);
  return message;
}

const agent = mastra.getAgent('supportAgent');
const threadId = randomUUID();
const resourceId = 'DEMO_USER_1';

async function logRes(res: Awaited<ReturnType<typeof agent.stream>>) {
  console.log(`\n🛠️ Support Agent:`);
  for await (const chunk of res.textStream) {
    process.stdout.write(chunk);
  }
  console.log(`\n\n`);
}

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  MASTRA MEMORY PROCESSORS DEMO - TOKEN LIMITING          ║
║                                                          ║
║  This example demonstrates the TokenLimiter processor    ║
║  which limits memory to a specified token count (2000).  ║
║  As the conversation grows, older messages will be       ║
║  automatically pruned to stay within the token limit.    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);

  // First question - basic introductory message
  await logRes(
    await agent.stream(
      log(
        "I'm having trouble with my laptop. It keeps shutting down randomly after about 30 minutes of use. I've had it for about 2 years and this just started happening last week.",
      ),
      {
        threadId,
        resourceId,
      },
    ),
  );

  // Second question - provide more detailed information
  await logRes(
    await agent.stream(
      log(
        "The laptop feels quite hot before it shuts down. I'm using a Dell XPS 15 with Windows 11. I usually have multiple browser tabs open and sometimes I'm running Visual Studio Code. The battery seems to drain quickly too.",
      ),
      {
        threadId,
        resourceId,
      },
    ),
  );

  // Third question - ask for a solution
  await logRes(
    await agent.stream(
      log(
        "I've tried restarting in safe mode and the problem doesn't happen there. Also, I checked for Windows updates and everything is current. What should I do to fix this issue?",
      ),
      {
        threadId,
        resourceId,
      },
    ),
  );

  // Fourth question - simulate a very lengthy exchange to demonstrate token limiting
  await logRes(
    await agent.stream(
      log(
        "I tried cleaning the fans as you suggested, but it's still happening. I also downloaded a temperature monitoring app and it shows the CPU reaching 90°C before shutting down. I looked for BIOS updates on Dell's website but couldn't find any for my specific model. My laptop is out of warranty. I also checked Task Manager and noticed that when I run certain applications, my CPU usage spikes to nearly 100%. My friend suggested it might be a failing thermal paste. Do you think I should try replacing the thermal paste myself or take it to a repair shop? I've never opened a laptop before but I'm somewhat technically inclined. Also, is there a way to limit how much CPU power certain applications use?",
      ),
      {
        threadId,
        resourceId,
      },
    ),
  );

  // Fifth question - ask about previous information that might be forgotten due to token limiting
  await logRes(
    await agent.stream(
      log(
        'Can you remind me what was the first thing you suggested I should check? Also, do you think a cooling pad would help with my issue?',
      ),
      {
        threadId,
        resourceId,
      },
    ),
  );

  // Use the search tool to demonstrate tool call behavior with token limiting
  await logRes(
    await agent.stream(log('Can you search for common causes of laptop overheating?'), {
      threadId,
      resourceId,
    }),
  );

  process.exit(0);
}

main();

