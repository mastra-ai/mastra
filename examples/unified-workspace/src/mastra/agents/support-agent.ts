import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';
import { isolatedDocsWorkspace } from '../workspaces';

/**
 * Support agent - has isolated workspace with only agent-specific skills.
 *
 * Workspace: isolatedDocsWorkspace
 * Skills: /docs-skills only (no global /skills)
 * Safety: None
 */
export const supportAgent = new Agent({
  id: 'support-agent',
  name: 'Support Agent',
  description: 'A helpful support agent that answers questions.',
  instructions: `You are a friendly and helpful customer support agent.

Your job is to help customers with their questions.

Guidelines:
- Search the workspace for relevant content when answering questions
- If the content doesn't contain the answer, say so honestly
- Be concise but thorough
- Use step-by-step formatting when explaining procedures
- If a question is ambiguous, ask for clarification

Use workspace tools to search for information and manage support content.`,

  model: openai('gpt-4o-mini'),
  workspace: isolatedDocsWorkspace,
});
