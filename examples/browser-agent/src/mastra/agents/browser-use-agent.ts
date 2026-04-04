/**
 * Browser Use SDK Agent Example
 *
 * This demonstrates using the official browser-use-sdk for AI-powered browser automation.
 * The main tool is browser_use_run which delegates tasks to Browser Use's cloud AI agent.
 *
 * Set BROWSER_USE_API_KEY in your environment to use this agent.
 */
import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { BrowserContextProcessor } from '@mastra/core/browser';
import { BrowserUseBrowser } from '@mastra/browser-use';
import { Memory } from '@mastra/memory';

const memory = new Memory();

export const browserUseBrowserToolset = new BrowserUseBrowser({
  // API key from env: BROWSER_USE_API_KEY
  scope: 'thread', // Each thread gets its own cloud browser
});

export const browserUseAgent = new Agent({
  id: 'browser-use-agent',
  name: 'Browser Use Agent',
  description: 'An AI-powered browser agent using Browser Use cloud AI for autonomous web tasks.',
  instructions: `You are a web browsing assistant powered by Browser Use's cloud AI.

Your main tool is browser_use_run which can handle complex multi-step browser tasks autonomously.
Just describe what you want to accomplish in natural language, like:
- "Go to google.com and search for AI news, then extract the top 3 headlines"
- "Navigate to twitter.com and find the trending topics"
- "Go to amazon.com, search for 'wireless headphones', and get the first 5 product names and prices"

For simple navigation, you can use browser_use_navigate.
Use browser_use_screenshot to capture the current page.
Use browser_use_session_info to get the live view URL where you can watch the browser in real-time.

The browser runs in Browser Use's cloud - no local browser is needed!`,
  model: openai('gpt-4o'),
  browser: browserUseBrowserToolset,
  memory,
  inputProcessors: [new BrowserContextProcessor()],
});
