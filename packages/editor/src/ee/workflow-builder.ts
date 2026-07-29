import type { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import type { IWorkflowBuilder, WorkflowBuilderOptions } from '@mastra/core/editor';
import type { MastraModelConfig } from '@mastra/core/llm';
import { WORKFLOW_BUILDER_AUTHORING_PLAYBOOK } from '@mastra/core/workflows/builder';
import { Memory } from '@mastra/memory';

export const DEFAULT_WORKFLOW_BUILDER_MODEL = 'openai/gpt-5.5';

export function createWorkflowBuilderAgent(model?: MastraModelConfig): Agent<'workflow-builder-agent'> {
  return new Agent({
    id: 'workflow-builder-agent',
    name: 'Workflow Builder',
    description: 'Builds persisted workflow definitions through constrained client tools',
    model: model ?? DEFAULT_WORKFLOW_BUILDER_MODEL,
    memory: new Memory(),
    instructions: `You are the Workflow Builder.

Turn the user's request into a complete canonical workflow definition using the registered agent, tool, and workflow catalogs supplied in the hidden authoring context. Never persist a workflow directly and never call a server-side save-workflow tool. Only the user's explicit Studio Save action may persist the finalized draft.

${WORKFLOW_BUILDER_AUTHORING_PLAYBOOK}

Treat the current unsaved authoring state, accepted definition, candidate definition, validation issues, and catalogs injected in each turn as authoritative. Use inspect-workflow-resources for authoritative Studio catalog discovery; references in the shared playbook to list-available-tools, list-available-agents, or list-available-workflows mean this inspection tool in Studio.

Reason about the whole definition first, then call submit-workflow-draft exactly once with one complete canonical definition. Do not submit alternative definitions in parallel. If that submission is rejected, use every returned diagnostic to correct the complete definition, then submit exactly one corrected definition. A successful submission automatically makes the draft Ready. Stop calling tools after a successful submission; never resubmit a Ready definition in the same turn. Never claim the draft was persisted. Finish with a concise summary and tell the user to review and use the explicit Studio Save action.`,
  });
}

export class EditorWorkflowBuilder implements IWorkflowBuilder {
  readonly enabled: boolean;
  private readonly agent;
  private readonly modelPolicy: WorkflowBuilderOptions['modelPolicy'];

  constructor(options: WorkflowBuilderOptions = {}, mastra?: Mastra) {
    this.enabled = options.enabled !== false;
    this.modelPolicy = options.modelPolicy;
    this.agent = createWorkflowBuilderAgent(options.model);
    if (mastra) {
      this.agent.__registerMastra(mastra);
      this.agent.__registerPrimitives({ logger: mastra.getLogger(), storage: mastra.getStorage() });
    }
  }

  getAgent() {
    return this.agent;
  }

  getModelPolicy() {
    return this.modelPolicy;
  }
}
