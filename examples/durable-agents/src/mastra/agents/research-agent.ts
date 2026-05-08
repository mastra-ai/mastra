/**
 * Research Agent - Demonstrates all three durable agent patterns
 *
 * This file creates the same base agent wrapped three different ways:
 * 1. createDurableAgent - resumable streams only
 * 2. createEventedAgent - resumable streams + workflow engine execution
 * 3. createInngestAgent - resumable streams + Inngest execution
 */

import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { EventEmitterPubSub } from '@mastra/core/events';
import { createInngestAgent } from '@mastra/inngest';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';

import { inngest } from '../workflows/inngest';

// Shared pubsub for evented agent (can also be inherited from Mastra)
const pubsub = new EventEmitterPubSub();

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
  execute: async (inputData: { query: string }) => {
    const { query } = inputData;
    console.log(`[web-search] Searching for: ${query}`);
    await new Promise(resolve => setTimeout(resolve, 500));

    return {
      results: [
        {
          title: `Understanding ${query} - Comprehensive Guide`,
          snippet: `A detailed explanation of ${query} covering fundamentals and best practices.`,
          url: `https://example.com/guide/${encodeURIComponent(query)}`,
        },
        {
          title: `${query} in 2024: Latest Trends`,
          snippet: `Explore the latest developments and trends in ${query}.`,
          url: `https://example.com/trends/${encodeURIComponent(query)}`,
        },
      ],
    };
  },
});

// Base agent configuration (shared across all patterns)
const baseAgentConfig = {
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
};

// Regular agent (for comparison)
export const regularResearchAgent = new Agent({
  id: 'regular-research-agent',
  name: 'Research Agent (Regular)',
  ...baseAgentConfig,
});

// 1. Plain Durable Agent
// Resumable streams only - execution stays in HTTP request
// Use when you want reconnection support but don't need durable execution
export const durableResearchAgent = createDurableAgent({
  agent: new Agent({
    id: 'durable-research-agent',
    name: 'Research Agent (Durable)',
    ...baseAgentConfig,
  }),
  // cache and pubsub inherited from Mastra
});

// 2. Evented Agent
// Resumable streams + fire-and-forget execution via workflow engine
// Use for long-running operations on single-instance deployments
export const eventedResearchAgent = createEventedAgent({
  agent: new Agent({
    id: 'evented-research-agent',
    name: 'Research Agent (Evented)',
    ...baseAgentConfig,
  }),
  pubsub,
  // cache inherited from Mastra
});

// 3. Inngest Agent
// Resumable streams + Inngest-powered durable execution
// Use for production distributed systems
export const inngestResearchAgent = createInngestAgent({
  agent: new Agent({
    id: 'inngest-research-agent',
    name: 'Research Agent (Inngest)',
    ...baseAgentConfig,
  }),
  inngest,
  // cache and pubsub inherited from Mastra
});
