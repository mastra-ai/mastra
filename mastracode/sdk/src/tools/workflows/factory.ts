import type { DynamicWorkflowAccessPolicy } from '../../workflows/access-policy.js';
import { createDeleteWorkflowTool } from './delete-workflow.js';
import { createGetWorkflowTool } from './get-workflow.js';
import { createListAvailableWorkflowsTool } from './list-available-workflows.js';
import { createListWorkflowsTool } from './list-workflows.js';
import { createRunWorkflowTool } from './run-workflow.js';
import { createSaveWorkflowTool, type CreateSaveWorkflowToolOptions } from './save-workflow.js';
import { WORKFLOW_AUTHORING_TOOL_IDS, WORKFLOW_MANAGEMENT_TOOL_IDS } from './tool-ids.js';

export interface CreateWorkflowToolsetOptions {
  accessPolicy?: DynamicWorkflowAccessPolicy;
  saveAuthorization?: CreateSaveWorkflowToolOptions['authorize'];
}

export function createWorkflowManagementTools(options: CreateWorkflowToolsetOptions = {}) {
  const { accessPolicy } = options;
  return {
    [WORKFLOW_MANAGEMENT_TOOL_IDS.listWorkflows]: createListWorkflowsTool(accessPolicy),
    [WORKFLOW_MANAGEMENT_TOOL_IDS.getWorkflow]: createGetWorkflowTool(accessPolicy),
    [WORKFLOW_MANAGEMENT_TOOL_IDS.runWorkflow]: createRunWorkflowTool(accessPolicy),
    [WORKFLOW_MANAGEMENT_TOOL_IDS.deleteWorkflow]: createDeleteWorkflowTool(accessPolicy),
  };
}

export function createWorkflowAuthoringTools(options: CreateWorkflowToolsetOptions = {}) {
  return {
    [WORKFLOW_AUTHORING_TOOL_IDS.listWorkflows]: createListAvailableWorkflowsTool(options.accessPolicy),
    [WORKFLOW_AUTHORING_TOOL_IDS.saveWorkflow]: createSaveWorkflowTool({
      accessPolicy: options.accessPolicy,
      authorize: options.saveAuthorization,
    }),
  };
}
