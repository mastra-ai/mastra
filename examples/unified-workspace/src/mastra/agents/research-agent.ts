import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { readonlyWorkspace } from '../workspaces';

/**
 * Research agent - analyzes code and gathers information.
 *
 * Workspace: readonlyWorkspace
 * Safety: readOnly: true (write tools excluded)
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
});
