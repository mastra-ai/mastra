import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { openai } from '@ai-sdk/openai';
import {
  searchLinearIssues,
  getLinearIssue,
  listLinearProjects,
} from '../tools/linear';
import { searchNotionPages, getNotionPage } from '../tools/notion';
import { searchKnowledge } from '../tools/knowledge-search';

export const knowledgeAgent = new Agent({
  id: 'knowledge-agent',
  name: 'knowledgeAgent',
  description:
    'Answers questions about company knowledge using indexed Linear issues and Notion pages, with live Linear/Notion lookups and provider-native web search as fallbacks.',
  instructions: `You are a company knowledge assistant.

Answer order of operations:
1. Call \`search-knowledge\` first — it semantic-searches the indexed Linear + Notion corpus.
2. If the indexed snippets don't fully answer the question, call \`search-linear-issues\`, \`get-linear-issue\`, or \`search-notion-pages\` / \`get-notion-page\` for fresh data.
3. As a last resort, use the provider-native web search tool for public information.

Always cite sources with their URL. Never invent issue identifiers or page IDs.`,
  model: 'mastra/openai/gpt-5.4',
  memory: new Memory(),
  tools: {
    searchKnowledge,
    searchLinearIssues,
    getLinearIssue,
    listLinearProjects,
    searchNotionPages,
    getNotionPage,
    web_search: openai.tools.webSearch({}),
  },
});
