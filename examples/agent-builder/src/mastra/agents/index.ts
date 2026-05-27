import { Agent } from '@mastra/core/agent';
import { openai } from '@ai-sdk/openai';
import { StagehandBrowser } from '@mastra/stagehand';

export const weatherAgent = new Agent({
  id: 'weather-agent',
  name: 'weather-agent',
  instructions: 'You answer questions about the weather concisely.',
  model: openai('gpt-4o-mini'),
});

export const browserAgent = new Agent({
  id: 'browser-agent',
  name: 'browser-agent',
  instructions:
    'You browse the web to answer questions. Use the browser tools to navigate, observe, act, and extract content. Close the browser when finished.',
  model: openai('gpt-4o-mini'),
  browser: new StagehandBrowser({
    apiKey: process.env.BROWSERBASE_API_KEY ?? '',
    env: 'BROWSERBASE',
    projectId: process.env.BROWSERBASE_PROJECT_ID ?? '',
  }),
});
