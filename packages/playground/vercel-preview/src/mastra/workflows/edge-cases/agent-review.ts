import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod/v4';
import { workflowReviewAgent } from '../../agents/workflow-review-agent';

export const agentReview = createWorkflow({
  id: 'agent-review',
  description:
    'A real agent step. The default preview-tripwire input stops before a model call. Other prompts use the configured provider and require an API key.',
  inputSchema: z.object({ prompt: z.string().min(1).max(1000).default('preview-tripwire') }),
  outputSchema: z.object({ text: z.string() }),
})
  .agent(workflowReviewAgent)
  .commit();
