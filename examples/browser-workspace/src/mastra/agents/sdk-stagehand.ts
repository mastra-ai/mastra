/**
 * SDK-based Stagehand agent.
 * Uses @mastra/stagehand SDK provider (not CLI).
 */
import { Agent } from '@mastra/core/agent';
import { StagehandBrowser } from '@mastra/stagehand';
import { Memory } from '@mastra/memory';

const memory = new Memory();

export const sdkStagehandAgent = new Agent({
  id: 'sdk-stagehand',
  name: 'SDK Stagehand',
  description: 'An agent using @mastra/stagehand SDK for browser automation.',
  instructions: `You are a helpful assistant with browser capabilities via the Stagehand SDK.

You can browse the web, interact with pages, and help users with web-based tasks.

When asked to visit a website or interact with web content, use your browser tools.`,
  model: 'openai/gpt-4.1',
  browser: new StagehandBrowser({
    headless: false,
  }),
  memory,
});
