import type { Mastra } from '@mastra/core';
import type { IWorkflowBuilder, WorkflowBuilderOptions } from '@mastra/core/editor';
import { createWorkflowBuilderAgent } from './workflow-builder-agent';

export class EditorWorkflowBuilder implements IWorkflowBuilder {
  readonly enabled: boolean;
  private readonly agent;
  private readonly modelPolicy: WorkflowBuilderOptions['modelPolicy'];

  constructor(options: WorkflowBuilderOptions = {}, mastra?: Mastra) {
    this.enabled = options.enabled !== false;
    this.modelPolicy = options.modelPolicy;
    this.agent = createWorkflowBuilderAgent();
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
