// AUTO-GENERATED from rhysbalevicius/integration-templates @ fe8e08c019e7 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { compareBranchSchemaTool } from './tools/compare-branch-schema.js';
import { createBranchTool } from './tools/create-branch.js';
import { createEndpointTool } from './tools/create-endpoint.js';
import { createProjectTool } from './tools/create-project.js';
import { deleteBranchTool } from './tools/delete-branch.js';
import { deleteEndpointTool } from './tools/delete-endpoint.js';
import { getBranchSchemaTool } from './tools/get-branch-schema.js';
import { getBranchTool } from './tools/get-branch.js';
import { getEndpointTool } from './tools/get-endpoint.js';
import { getOperationTool } from './tools/get-operation.js';
import { getProjectTool } from './tools/get-project.js';
import { listBranchEndpointsTool } from './tools/list-branch-endpoints.js';
import { listBranchesTool } from './tools/list-branches.js';
import { listDatabasesTool } from './tools/list-databases.js';
import { listEndpointsTool } from './tools/list-endpoints.js';
import { listOperationsTool } from './tools/list-operations.js';
import { listProjectsTool } from './tools/list-projects.js';
import { restartEndpointTool } from './tools/restart-endpoint.js';
import { setDefaultBranchTool } from './tools/set-default-branch.js';
import { startEndpointTool } from './tools/start-endpoint.js';
import { suspendEndpointTool } from './tools/suspend-endpoint.js';
import { updateBranchTool } from './tools/update-branch.js';
import { updateEndpointTool } from './tools/update-endpoint.js';
import { updateProjectTool } from './tools/update-project.js';

export function createNeonTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    neon_compare_branch_schema: compareBranchSchemaTool(platformProxy),
    neon_create_branch: createBranchTool(platformProxy),
    neon_create_endpoint: createEndpointTool(platformProxy),
    neon_create_project: createProjectTool(platformProxy),
    neon_delete_branch: deleteBranchTool(platformProxy),
    neon_delete_endpoint: deleteEndpointTool(platformProxy),
    neon_get_branch_schema: getBranchSchemaTool(platformProxy),
    neon_get_branch: getBranchTool(platformProxy),
    neon_get_endpoint: getEndpointTool(platformProxy),
    neon_get_operation: getOperationTool(platformProxy),
    neon_get_project: getProjectTool(platformProxy),
    neon_list_branch_endpoints: listBranchEndpointsTool(platformProxy),
    neon_list_branches: listBranchesTool(platformProxy),
    neon_list_databases: listDatabasesTool(platformProxy),
    neon_list_endpoints: listEndpointsTool(platformProxy),
    neon_list_operations: listOperationsTool(platformProxy),
    neon_list_projects: listProjectsTool(platformProxy),
    neon_restart_endpoint: restartEndpointTool(platformProxy),
    neon_set_default_branch: setDefaultBranchTool(platformProxy),
    neon_start_endpoint: startEndpointTool(platformProxy),
    neon_suspend_endpoint: suspendEndpointTool(platformProxy),
    neon_update_branch: updateBranchTool(platformProxy),
    neon_update_endpoint: updateEndpointTool(platformProxy),
    neon_update_project: updateProjectTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
