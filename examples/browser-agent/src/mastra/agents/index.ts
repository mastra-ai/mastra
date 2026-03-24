import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { AgentBrowser } from '@mastra/agent-browser';

export const browserToolset = new AgentBrowser({
  headless: true,
  timeout: 15_000,
});

export const browserAgent = new Agent({
  id: 'browser-agent',
  name: 'Browser Agent',
  description: 'An agent that can browse websites, capture snapshots, and interact with web elements.',
  instructions: `You are a web browsing assistant that can navigate websites and interact with page elements.

After navigating to a page, use browser_extract with action "snapshot" to see the page structure and get element refs (@e1, @e2, etc.). Use these refs to interact with elements.

After any interaction, take a new snapshot since refs become stale when the page changes.`,
  model: openai('gpt-4o'),
  browser: browserToolset,
});
