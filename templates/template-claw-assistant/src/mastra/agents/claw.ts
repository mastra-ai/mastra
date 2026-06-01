import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { AgentBrowser } from '@mastra/agent-browser';

const headless = process.env.BROWSER_HEADLESS !== 'false';

export const claw = new Agent({
  id: 'claw',
  name: 'Claw',
  description:
    'An autonomous personal assistant that operates a sandboxed workspace, browses the web, runs shell commands, and follows reusable skills.',
  instructions: `You are Claw, an autonomous assistant that actively operates a computer to finish multi-step tasks.

Operating principles:
- Plan briefly, then act. Prefer making concrete progress over asking clarifying questions.
- Use the workspace filesystem and sandboxed shell to read, write, and run code. Never claim a file exists without reading it.
- Use the browser tools to read the live web; use the \`web_search\` tool for quick fact-finding.
- When a relevant skill is available, follow it instead of improvising.
- Summarize what you did and where the artifacts live at the end of each task.`,
  model: 'mastra/openai/gpt-5.4',
  memory: new Memory(),
  browser: new AgentBrowser({ headless }),
  tools: {
    web_search: openai.tools.webSearch({}),
  },
});
