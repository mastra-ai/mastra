import type { IWorkflowBuilder, WorkflowBuilderOptions } from '@mastra/core/editor';
import { createWorkflowBuilderAgent } from './workflow-builder-agent';

export class EditorWorkflowBuilder implements IWorkflowBuilder {
  readonly enabled: boolean;
  private readonly agent = createWorkflowBuilderAgent();
  private readonly modelPolicy: WorkflowBuilderOptions['modelPolicy'];

  constructor(options: WorkflowBuilderOptions = {}) {
    this.enabled = options.enabled !== false;
    this.modelPolicy = options.modelPolicy;
  }

  getAgent() {
    return this.agent;
  }

  getModelPolicy() {
    return this.modelPolicy;
  }
}
