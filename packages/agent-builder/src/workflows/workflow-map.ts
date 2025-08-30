import { agentBuilderTemplateWorkflow } from './template-builder/template-builder';
import { workflowBuilderWorkflow } from './workflow-builder/workflow-builder';

export const workflowMap = {
  'merge-template': agentBuilderTemplateWorkflow,
  'workflow-builder': workflowBuilderWorkflow,
};
