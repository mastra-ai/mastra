import { Agent } from '@mastra/core/agent';
import { BrowserContextProcessor } from '@mastra/core/browser';
import { AgentBrowser } from '@mastra/agent-browser';
import { Memory } from '@mastra/memory';

const memory = new Memory();

// Browser-Use CDP URL for testing external browser connections
const CDP_URL = process.env.BROWSER_CDP_URL;

export const agentBrowserToolset = new AgentBrowser({
  cdpUrl: CDP_URL,
  headless: !CDP_URL, // Use headed mode when connecting to external browser
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
  model: 'openai/gpt-5.2',
  browser: agentBrowserToolset,
  memory,
  inputProcessors: [new BrowserContextProcessor()],
});
