// AUTO-GENERATED from rhysbalevicius/integration-templates @ 7b5b21291772 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { createBranchTool } from './tools/create-branch.js';
import { createProjectTool } from './tools/create-project.js';
import { deleteBranchTool } from './tools/delete-branch.js';
import { getBranchTool } from './tools/get-branch.js';
import { getEndpointTool } from './tools/get-endpoint.js';
import { getOperationTool } from './tools/get-operation.js';
import { getProjectTool } from './tools/get-project.js';
import { listBranchesTool } from './tools/list-branches.js';
import { listDatabasesTool } from './tools/list-databases.js';
import { listEndpointsTool } from './tools/list-endpoints.js';
import { listOperationsTool } from './tools/list-operations.js';
import { listProjectsTool } from './tools/list-projects.js';

export function createNeonTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    neon_create_branch: createBranchTool(platformProxy),
    neon_create_project: createProjectTool(platformProxy),
    neon_delete_branch: deleteBranchTool(platformProxy),
    neon_get_branch: getBranchTool(platformProxy),
    neon_get_endpoint: getEndpointTool(platformProxy),
    neon_get_operation: getOperationTool(platformProxy),
    neon_get_project: getProjectTool(platformProxy),
    neon_list_branches: listBranchesTool(platformProxy),
    neon_list_databases: listDatabasesTool(platformProxy),
    neon_list_endpoints: listEndpointsTool(platformProxy),
    neon_list_operations: listOperationsTool(platformProxy),
    neon_list_projects: listProjectsTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
