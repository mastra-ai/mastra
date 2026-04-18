/**
 * SDK-based Agent Browser agent.
 * Uses @mastra/agent-browser SDK provider (not CLI).
 */
import { Agent } from '@mastra/core/agent';
import { AgentBrowser } from '@mastra/agent-browser';
import { Memory } from '@mastra/memory';

const memory = new Memory();

export const sdkAgentBrowserAgent = new Agent({
  id: 'sdk-agent-browser',
  name: 'SDK Agent Browser',
  description: 'An agent using @mastra/agent-browser SDK for browser automation.',
  instructions: `You are a helpful assistant with browser capabilities via the Agent Browser SDK.

You can browse the web, interact with pages, and help users with web-based tasks.

When asked to visit a website or interact with web content, use your browser tools.`,
  model: 'openai/gpt-5.4',
  browser: new AgentBrowser({
    headless: false,
  }),
  memory,
});
