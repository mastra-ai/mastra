import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { Memory } from '@mastra/memory';
import { LibSQLStore } from '@mastra/libsql';
import { readonlyWorkspace } from '../workspaces';

/**
 * Memory for the research agent - persists conversation history and findings.
 */
const researchMemory = new Memory({
  storage: new LibSQLStore({
    id: 'research-agent-memory-storage',
    url: 'file:./research-agent.db',
  }),
});

/**
 * Research agent - analyzes code and gathers information.
 *
 * Workspace: readonlyWorkspace
 * Safety: readOnly: true (write tools excluded)
 * Memory: Enabled - remembers previous research sessions
 */
export const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  description: 'An agent that analyzes code and gathers information.',
  instructions: `You are a code research and analysis assistant.

Your job is to help analyze codebases, find patterns, and gather information.

When researching:
1. Use workspace tools to read files and search for content
2. Analyze code structure and patterns
3. Summarize findings clearly
4. Provide specific file references and line numbers

Use workspace search to find relevant code and documentation.`,

  model: openai('gpt-4o-mini'),
  workspace: readonlyWorkspace,
  memory: researchMemory,
});
