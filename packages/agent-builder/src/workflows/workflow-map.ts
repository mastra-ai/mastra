import type { Workflow } from '@mastra/core/workflows';
import { agentBuilderTemplateWorkflow } from './template-builder/template-builder';
import { workflowBuilderWorkflow } from './workflow-builder/workflow-builder';

export const agentBuilderWorkflows: Record<string, Workflow<any, any, any, any, any, any>> = {
  'merge-template': agentBuilderTemplateWorkflow,
  'workflow-builder': workflowBuilderWorkflow,
};
