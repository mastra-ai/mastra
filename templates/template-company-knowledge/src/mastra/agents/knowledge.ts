import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { PIIDetector, UnicodeNormalizer } from '@mastra/core/processors';
import { openai } from '@ai-sdk/openai';
import { searchKnowledge } from '../tools/knowledge-search';
import { mcpClient } from '../mcp';

/**
 * Linear and Notion tools are loaded dynamically from MCP servers.
 * Linear: hosted at mcp.linear.app (25+ tools — search, create, update issues, projects, etc.)
 * Notion: via the installed @notionhq/notion-mcp-server subprocess (search, read, create, update pages/databases)
 *
 * Tool names are namespaced: linear_<tool> and notion_<tool>.
 */
async function getMcpTools() {
  try {
    return await mcpClient.listTools();
  } catch (error) {
    console.warn(
      'Failed to load Linear/Notion MCP tools. The agent will continue with indexed search and web search only.',
      error,
    );
    return {};
  }
}

export const knowledgeAgent = new Agent({
  id: 'knowledge-agent',
  name: 'Company Knowledge',
  description:
    'Answers questions about company knowledge using indexed Linear issues and Notion pages, with live Linear/Notion lookups and provider-native web search as fallbacks.',
  instructions: `You are a company knowledge assistant. You help the team find information across Linear (issues, projects) and Notion (docs, wikis, databases) — both from a pre-indexed semantic search corpus and via live lookups.

## Your tools

**Indexed search (fastest, search here first):**
- search-knowledge — semantic vector search over the pre-indexed Linear + Notion corpus. Returns scored snippets with source, title, URL. Use this for any factual question about the company.

**Live Linear lookups (via MCP — tools prefixed with \`linear_\`):**
Linear tools are loaded dynamically from the official Linear MCP server. The exact tool names are discovered at runtime. Look for tools prefixed with \`linear_\` — they cover searching issues, fetching issue details, listing projects, and more.
Use these when indexed results are stale or missing, or the user references a specific Linear issue/project.

**Live Notion lookups (via MCP — tools prefixed with \`notion_\`):**
Notion tools are loaded dynamically from the official Notion MCP server. The exact tool names are discovered at runtime. Look for tools prefixed with \`notion_\` — they cover searching pages/databases, reading page content, creating pages, and more.
Use these when indexed results are stale or the user asks about a specific Notion doc.

**Public fallback:**
- web_search — search the public web. Only use this for questions that aren't about internal company data (e.g. "what's the latest Node.js LTS version?").

## Lookup strategy

Follow this order strictly — it saves API calls and gives faster answers:

1. **Start with search-knowledge.** If the top results (score > 0.75) answer the question, use them and stop.
2. **If indexed results are weak (score < 0.7 or don't address the question):**
   - For Linear questions → use linear_ tools.
   - For Notion questions → use notion_ tools.
3. **Combine sources.** If the answer spans both Linear and Notion, say so. "According to ENG-456 and the API Design doc in Notion..."
4. **Web search is last resort.** Only for public/external information the company tools won't have.

## Response format

- Lead with the direct answer.
- Cite every source inline: \`[ENG-123](url)\` for Linear issues, \`[Page Title](url)\` for Notion pages.
- If indexed results are outdated (e.g. an issue was closed since indexing), note that and supplement with the live lookup.
- If you can't find the answer anywhere, say so. Never invent issue identifiers, page IDs, or URLs.
- For ambiguous questions, ask one clarifying question rather than guessing.`,
  model: 'mastra/openai/gpt-5.4',
  defaultOptions: {
    maxSteps: 100,
  },
  memory: new Memory({
    options: {
      lastMessages: 20,
    },
  }),
  // Guardrails: normalize unicode input, redact PII in responses (internal data may contain
  // employee emails, phone numbers, etc. that shouldn't be surfaced to all users).
  inputProcessors: [new UnicodeNormalizer({ stripControlChars: true, collapseWhitespace: true })],
  outputProcessors: [
    new PIIDetector({
      model: 'mastra/openai/gpt-5-nano',
      strategy: 'redact',
      redactionMethod: 'mask',
      detectionTypes: ['email', 'phone', 'credit-card', 'ssn', 'api-key'],
    }),
  ],
  tools: async () => ({
    searchKnowledge,
    ...(await getMcpTools()),
    web_search: openai.tools.webSearch({}),
  }),
});
