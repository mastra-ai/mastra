import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { BrowserContextProcessor } from '@mastra/core/browser';
import { StagehandBrowser } from '@mastra/stagehand';

export const stagehandBrowserToolset = new StagehandBrowser({
  env: 'LOCAL',
  model: 'openai/gpt-4o',
  headless: false,
  verbose: 1,
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
  model: openai('gpt-4o'),
  browser: stagehandBrowserToolset,
  inputProcessors: [new BrowserContextProcessor()],
});
