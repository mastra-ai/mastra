import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { AgentBrowser } from '@mastra/agent-browser';

export const agentBrowserToolset = new AgentBrowser({
  headless: true, // Changed to true for testing screencast in headless mode
  timeout: 15_000,
});

export const agentBrowserAgent = new Agent({
  id: 'agent-browser-agent',
  name: 'Agent Browser Agent',
  description: 'An agent that uses deterministic refs to browse and interact with web pages.',
  instructions: `You are a web browsing assistant that can navigate websites and interact with page elements.

Use browser_goto to navigate to URLs. After navigating, use browser_snapshot to see the page structure and get element refs ([ref=e1], [ref=e2], etc.).

Use these refs with tools like browser_click, browser_type, etc. to interact with elements.

IMPORTANT: After any interaction that changes the page, take a new snapshot since refs become stale when the page changes.`,
  model: openai('gpt-4o'),
  browser: agentBrowserToolset,
});
