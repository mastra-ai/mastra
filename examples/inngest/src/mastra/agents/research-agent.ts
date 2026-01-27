/**
 * Research Agent - A simple durable agent example
 *
 * This demonstrates a basic durable agent that can search the web
 * and summarize findings. The entire agentic loop is durable - if
 * the server crashes mid-execution, Inngest resumes from the last
 * completed step.
 */

import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createInngestAgent } from '@mastra/inngest';
import { z } from 'zod';

import { inngest } from '../workflows/inngest-workflow';

// Simple web search tool (simulated for demo purposes)
const webSearchTool = createTool({
  id: 'web-search',
  description: 'Search the web for information on a topic',
  inputSchema: z.object({
    query: z.string().describe('The search query'),
  }),
  outputSchema: z.object({
    results: z.array(
      z.object({
        title: z.string(),
        snippet: z.string(),
        url: z.string(),
      }),
    ),
  }),
  execute: async inputData => {
    const { query } = inputData;

    // Simulate a web search with mock results
    // In production, you'd call a real search API (Google, Bing, Tavily, etc.)
    console.log(`[web-search] Searching for: ${query}`);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      results: [
        {
          title: `Understanding ${query} - Comprehensive Guide`,
          snippet: `A detailed explanation of ${query} covering the fundamentals, best practices, and advanced concepts.`,
          url: `https://example.com/guide/${encodeURIComponent(query)}`,
        },
        {
          title: `${query} in 2024: Latest Trends`,
          snippet: `Explore the latest developments and trends in ${query}, including recent breakthroughs and future predictions.`,
          url: `https://example.com/trends/${encodeURIComponent(query)}`,
        },
        {
          title: `How to Get Started with ${query}`,
          snippet: `A beginner-friendly tutorial on ${query} with step-by-step instructions and practical examples.`,
          url: `https://example.com/tutorial/${encodeURIComponent(query)}`,
        },
      ],
    };
  },
});

// Create the base agent
const researchAgentBase = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  model: 'openai/gpt-4o',
  instructions: `You are a research assistant that helps users find and summarize information.

When given a research topic:
1. Use the web-search tool to find relevant information
2. Analyze the search results
3. Provide a clear, well-organized summary

Be thorough but concise. Cite your sources when presenting findings.`,
  tools: {
    webSearch: webSearchTool,
  },
});

// Wrap with durable execution via Inngest
export const researchAgent = createInngestAgent({
  agent: researchAgentBase,
  inngest,
});
