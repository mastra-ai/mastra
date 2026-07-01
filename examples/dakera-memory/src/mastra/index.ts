import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { createOpenAI } from '@ai-sdk/openai';
import { dakeraRecallTool, dakeraStoreTool } from './dakera-tools';

const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * A Mastra agent with Dakera-backed persistent memory.
 *
 * The agent has two tools:
 *   - dakera-recall: semantic search across all prior stored memories
 *   - dakera-store:  persist important context for future sessions
 *
 * The system prompt tells the agent when to use each tool so it behaves
 * like a memory-aware assistant by default.
 */
export const memoryAgent = new Agent({
  name: 'memory-agent',
  instructions: `You are a helpful assistant with access to persistent long-term memory.

At the START of every conversation:
1. Call the dakera-recall tool with a summary of the user's first message to retrieve relevant prior context.
2. If memories are found, briefly acknowledge them so the user knows their history is available.

During the conversation:
- When the user shares preferences, goals, decisions, or facts about themselves, call dakera-store to persist them.
- When the user asks about something they've discussed before, call dakera-recall before answering.
- Be explicit when you're using recalled memories ("Based on what I remember from last time...")

At the END of an important exchange:
- Store a short summary of any key decisions or context from this session so it is available next time.

Keep stored memories concise and factual. Prefer specific, self-contained statements over vague summaries.`,
  model: openai.languageModel('gpt-4o-mini'),
  tools: {
    dakeraRecall: dakeraRecallTool,
    dakeraStore: dakeraStoreTool,
  },
});

export const mastra = new Mastra({
  agents: { memoryAgent },
});
