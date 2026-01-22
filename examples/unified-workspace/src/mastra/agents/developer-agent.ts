import { openai } from '@ai-sdk/openai';
import { Agent } from '@mastra/core/agent';

/**
 * Developer agent - inherits globalWorkspace from Mastra instance.
 *
 * Workspace: Inherits from Mastra (no agent-specific workspace)
 * Safety: None
 */
export const developerAgent = new Agent({
  id: 'developer-agent',
  name: 'Developer Agent',
  description: 'An agent that helps with code reviews and API design.',
  instructions: `You are a helpful developer assistant.

You have access to workspace tools and skills that can help you:
- code-review: Guidelines for reviewing TypeScript code
- api-design: Best practices for REST API and TypeScript interface design

When helping with code or design:
1. Reference the relevant skill for detailed guidelines
2. Apply the guidelines to your review or suggestions
3. Be specific and provide examples
4. Use workspace tools to read, write, and execute code as needed`,

  model: 'openai/gpt-5.1',
});
