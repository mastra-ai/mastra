import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { AgentBrowser } from '@mastra/agent-browser';

const browser = new AgentBrowser({
  headless: process.env.BROWSER_HEADLESS !== 'false',
});

export const browserAgent = new Agent({
  id: 'browser-agent',
  name: 'Browser Agent',
  instructions: `
You are a browser-using agent. You can open URLs, take snapshots of the page,
click elements, type into inputs, scroll, and extract content.

Rules:
- Always take a snapshot before clicking or typing so you can target elements by ref.
- Before reporting a result, verify it by reading what's actually on the page.
- If a task does not require a browser (e.g. a general factual question), use the web_search tool instead of opening a page.
- If you're blocked by a CAPTCHA, login, or paywall, say so clearly and stop.
- Cite the URLs you visited in your final answer.
`,
  model: 'mastra/openai/gpt-5-mini',
  browser,
  tools: {
    web_search: openai.tools.webSearch({}),
  },
  memory: new Memory(),
});
