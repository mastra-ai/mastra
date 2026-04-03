import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { StagehandBrowser } from '@mastra/stagehand';
import { Memory } from '@mastra/memory';

const memory = new Memory();

// Cloud provider credentials
// Priority: Browserbase > Browserless > Generic CDP URL > Local

// Option 1: Browserbase (native Stagehand integration)
const BROWSERBASE_API_KEY = process.env.BROWSERBASE_API_KEY;
const BROWSERBASE_PROJECT_ID = process.env.BROWSERBASE_PROJECT_ID;

// Option 2: Browserless (via CDP URL)
const BROWSERLESS_TOKEN = process.env.BROWSERLESS_TOKEN;

// Option 3: Generic CDP URL (Browser-Use, Steel, etc.)
const CDP_URL = process.env.BROWSER_CDP_URL;

// Determine which provider to use
const useBrowserbase = !!(BROWSERBASE_API_KEY && BROWSERBASE_PROJECT_ID);
const useBrowserless = !!BROWSERLESS_TOKEN && !useBrowserbase;
const useCdpUrl = !!CDP_URL && !useBrowserbase && !useBrowserless;

// Build CDP URL for Browserless
const browserlessCdpUrl = BROWSERLESS_TOKEN
  ? `wss://production-sfo.browserless.io?token=${BROWSERLESS_TOKEN}&stealth=true`
  : undefined;

export const stagehandBrowserToolset = new StagehandBrowser({
  // Environment selection
  env: useBrowserbase ? 'BROWSERBASE' : 'LOCAL',

  // Browserbase credentials (only used when env = 'BROWSERBASE')
  apiKey: BROWSERBASE_API_KEY,
  projectId: BROWSERBASE_PROJECT_ID,

  // CDP URL for Browserless or other cloud providers (only used when env = 'LOCAL')
  cdpUrl: useBrowserless ? browserlessCdpUrl : useCdpUrl ? CDP_URL : undefined,

  // AI model for act/extract/observe
  model: 'anthropic/claude-sonnet-4-20250514',

  // Headless mode: false for cloud providers (we want to see the browser)
  // headless: useBrowserbase || useBrowserless || useCdpUrl ? false : true,
  headless: false,

  verbose: 0,
});

export const stagehandAgent = new Agent({
  id: 'stagehand-agent',
  name: 'Stagehand Agent',
  description: 'An AI-powered browser agent that uses natural language to interact with web pages.',
  instructions: `You are a web browsing assistant powered by Stagehand AI.

Use stagehand_navigate to go to URLs. Use stagehand_observe to discover available actions on the page.

Use stagehand_act with natural language instructions like:
- "click the login button"
- "type hello into the search box"
- "scroll down"

Use stagehand_extract to pull structured data from pages.

You don't need element refs - just describe what you want to do in plain English!`,
  model: openai('gpt-5.4'),
  browser: stagehandBrowserToolset,
  memory,
});
