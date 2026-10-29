import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

const DOCS: Record<string, string> = {
  'pricing/overview': 'Mastra is open source (Apache 2.0). Mastra Cloud has a free tier and paid team plans.',
  'pricing/cloud': 'Mastra Cloud bills per seat on team plans. Usage-based limits apply to deployments and traces.',
  'agents/overview': 'Agents use LLMs and tools to solve open-ended tasks. Configure them with instructions, a model and tools.',
  'agents/max-steps': 'maxSteps limits how many LLM steps an agent runs. When the limit is hit mid tool-call, no final text is produced.',
  'workflows/overview': 'Workflows orchestrate steps with explicit control flow: then, branch, parallel, foreach.',
};

const searchDocs = createTool({
  id: 'searchDocs',
  description: 'Search the Mastra documentation. Returns matching page paths.',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => {
    const terms = query.toLowerCase().split(/\s+/);
    const hits = Object.keys(DOCS).filter(path => terms.some(term => `${path} ${DOCS[path]}`.toLowerCase().includes(term)));
    return { hits: hits.length, paths: hits };
  },
});

const readDocs = createTool({
  id: 'readDocs',
  description: 'Read a Mastra documentation page by path.',
  inputSchema: z.object({ path: z.string() }),
  execute: async ({ path }) => ({ path, content: DOCS[path] ?? 'Page not found.' }),
});

const instructions = `
You answer questions about Mastra using ONLY the documentation tools.
Before answering, always call searchDocs, then readDocs on every relevant page, then searchDocs again to double-check.
Then write a concise markdown answer with a heading and a bullet list.
`;

export const docsAgent = new Agent({
  id: 'docs-agent',
  name: 'Docs Agent',
  instructions,
  model: 'openai/gpt-5.5',
  tools: { searchDocs, readDocs },
  defaultOptions: { maxSteps: 12 },
});

// Same agent with a tight step budget: it runs out of steps while still calling
// tools, so the run ends with tool calls but an empty `text` (the prod case).
export const docsAgentStepLimited = new Agent({
  id: 'docs-agent-step-limited',
  name: 'Docs Agent (step limited)',
  instructions,
  model: 'openai/gpt-5.5',
  tools: { searchDocs, readDocs },
  defaultOptions: { maxSteps: 2 },
});
