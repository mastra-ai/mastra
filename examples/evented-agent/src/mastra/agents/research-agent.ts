/**
 * Research Agent - A simple durable agent example
 *
 * This demonstrates a basic durable agent using the built-in evented
 * workflow engine. The entire agentic loop is durable - if the server
 * crashes mid-execution, the workflow can be resumed.
 */

import { Agent } from '@mastra/core/agent';
import { createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

// Create a shared pubsub instance for the evented agents
export const pubsub = new EventEmitterPubSub();

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

// Create the base agent (also exported for trace comparison)
export const researchAgentRegular = new Agent({
  id: 'research-agent-regular',
  name: 'Research Agent (Regular)',
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

// Wrap with durable execution via the evented workflow engine
export const researchAgent = createEventedAgent({
  agent: researchAgentRegular,
  id: 'research-agent',
  name: 'Research Agent',
  pubsub,
});
