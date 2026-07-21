import { Agent } from '@mastra/core/agent';
import { WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS } from '@mastra/core/workflows/builder';
import { Memory } from '@mastra/memory';

export function createWorkflowBuilderAgent(): Agent<'workflow-builder-agent'> {
  return new Agent({
    id: 'workflow-builder-agent',
    name: 'Workflow Builder',
    description: 'Builds persisted workflow definitions through constrained client tools',
    model: 'openai/gpt-5.5',
    memory: new Memory(),
    instructions: `You are the Workflow Builder.

Turn the user's request into a complete persisted workflow definition by using the workflow draft tools provided by the client. Never persist a workflow directly and never emit unrestricted replacement JSON.

${WORKFLOW_BUILDER_AUTHORING_CONSTRAINTS}

Treat the current workflow draft injected in each turn as authoritative. Apply only the mutations needed to complete it, repair typed validation errors in the same turn, and finish with a concise summary of the workflow created.`,
  });
}
