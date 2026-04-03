import { Agent } from '@mastra/core/agent';
import { AgentBrowser } from '@mastra/agent-browser';
import { Memory } from '@mastra/memory';

const memory = new Memory();

// Cloud provider CDP URLs
// Priority: BROWSERLESS > BROWSER_CDP_URL > Local
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;
const CDP_URL = process.env.BROWSER_CDP_URL;

// Build CDP URL based on available credentials
const cdpUrl = BROWSERLESS_TOKEN
  ? `wss://production-sfo.browserless.io?token=${BROWSERLESS_TOKEN}&stealth=true`
  : CDP_URL;

export const agentBrowserToolset = new AgentBrowser({
  cdpUrl,
  headless: !cdpUrl, // Use headed mode when connecting to external browser
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
});
