import 'dotenv/config';
import { makeSend, searchTool } from './utils';
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { TokenLimiter } from '@mastra/memory/processors';
import { createLogger, Mastra } from '@mastra/core';

const memory = new Memory({
  processors: [new TokenLimiter(500)],
  options: {
    lastMessages: 50,
    semanticRecall: true,
  },
});

const techSupport = new Agent({
  name: 'Technical Support',
  instructions:
    'You are a technical support agent who helps users solve software problems. You provide concise, short, instructions and ask clarifying questions when needed. You remember details from earlier in the conversation. Your goal is to efficiently resolve user issues. Make sure you provide concise responses without tons of text',
  model: openai('gpt-4o-mini'),
  memory,
  tools: { searchTool },
});

const mastra = new Mastra({
  agents: { techSupport },
  logger: createLogger({ level: 'info' }),
});

console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║  MASTRA MEMORY PROCESSORS DEMO - TOKEN LIMITING          ║
║                                                          ║
║  This example demonstrates the TokenLimiter processor    ║
║  which limits memory to a specified token count (500).   ║
║  As the conversation grows, older messages will be       ║
║  automatically pruned to stay within the token limit.    ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);

const send = makeSend({
  agentName: `\n 💻 Support Agent`,
  agent: mastra.getAgent(`techSupport`),
});

await send(
  "I'm having trouble with my laptop. It keeps shutting down randomly after about 30 minutes of use. I've had it for about 2 years and this just started happening last week.",
);
await send('Can you search for common causes of laptop overheating?');
await send('Can you search again?');
await send(
  "The laptop feels quite hot before it shuts down. I'm using a Dell XPS 15 with Windows 11. I usually have multiple browser tabs open and sometimes I'm running Visual Studio Code. The battery seems to drain quickly too.",
);
await send(
  "I've tried restarting in safe mode and the problem doesn't happen there. Also, I checked for Windows updates and everything is current. What should I do to fix this issue?",
);
await send(
  "I tried cleaning the fans as you suggested, but it's still happening. I also downloaded a temperature monitoring app and it shows the CPU reaching 90°C before shutting down. My friend suggested it might be a failing thermal paste. Do you think I should try replacing the thermal paste myself or take it to a repair shop? I've never opened a laptop before but I'm somewhat technically inclined. Also, is there a way to limit how much CPU power certain applications use?",
);
await send(
  'Can you remind me what was the first thing you suggested I should check? Also, do you think a cooling pad would help with my issue?',
);
