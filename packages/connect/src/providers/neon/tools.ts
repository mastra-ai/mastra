// AUTO-GENERATED from rhysbalevicius/integration-templates @ 9629ccfaefd5 — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { compareBranchSchemaTool } from './tools/compare-branch-schema.js';
import { createBranchTool } from './tools/create-branch.js';
import { createDatabaseTool } from './tools/create-database.js';
import { createEndpointTool } from './tools/create-endpoint.js';
import { createProjectTool } from './tools/create-project.js';
import { createRoleTool } from './tools/create-role.js';
import { createSnapshotTool } from './tools/create-snapshot.js';
import { deleteBranchTool } from './tools/delete-branch.js';
import { deleteDatabaseTool } from './tools/delete-database.js';
import { deleteEndpointTool } from './tools/delete-endpoint.js';
import { deleteRoleTool } from './tools/delete-role.js';
import { deleteSnapshotTool } from './tools/delete-snapshot.js';
import { finalizeRestoreBranchTool } from './tools/finalize-restore-branch.js';
import { getAuthDetailsTool } from './tools/get-auth-details.js';
import { getBranchConsumptionTool } from './tools/get-branch-consumption.js';
import { getBranchSchemaTool } from './tools/get-branch-schema.js';
import { getBranchTool } from './tools/get-branch.js';
import { getDatabaseTool } from './tools/get-database.js';
import { getEndpointTool } from './tools/get-endpoint.js';
import { getOperationTool } from './tools/get-operation.js';
import { getProjectConsumptionTool } from './tools/get-project-consumption.js';
import { getProjectTool } from './tools/get-project.js';
import { getRoleTool } from './tools/get-role.js';
import { getSnapshotScheduleTool } from './tools/get-snapshot-schedule.js';
import { listBranchEndpointsTool } from './tools/list-branch-endpoints.js';
import { listBranchLogFieldValuesTool } from './tools/list-branch-log-field-values.js';
import { listBranchLogFieldsTool } from './tools/list-branch-log-fields.js';
import { listBranchesTool } from './tools/list-branches.js';
import { listDatabasesTool } from './tools/list-databases.js';
import { listEndpointsTool } from './tools/list-endpoints.js';
import { listOperationsTool } from './tools/list-operations.js';
import { listOrganizationsTool } from './tools/list-organizations.js';
import { listProjectsTool } from './tools/list-projects.js';
import { listRegionsTool } from './tools/list-regions.js';
import { listRolesTool } from './tools/list-roles.js';
import { listSharedProjectsTool } from './tools/list-shared-projects.js';
import { listSnapshotsTool } from './tools/list-snapshots.js';
import { queryBranchLogsTool } from './tools/query-branch-logs.js';
import { restartEndpointTool } from './tools/restart-endpoint.js';
import { restoreBranchTool } from './tools/restore-branch.js';
import { restoreSnapshotTool } from './tools/restore-snapshot.js';
import { setDefaultBranchTool } from './tools/set-default-branch.js';
import { setSnapshotScheduleTool } from './tools/set-snapshot-schedule.js';
import { startEndpointTool } from './tools/start-endpoint.js';
import { suspendEndpointTool } from './tools/suspend-endpoint.js';
import { updateBranchTool } from './tools/update-branch.js';
import { updateDatabaseTool } from './tools/update-database.js';
import { updateEndpointTool } from './tools/update-endpoint.js';
import { updateProjectTool } from './tools/update-project.js';
import { updateSnapshotTool } from './tools/update-snapshot.js';

export function createNeonTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    neon_compare_branch_schema: compareBranchSchemaTool(platformProxy),
    neon_create_branch: createBranchTool(platformProxy),
    neon_create_database: createDatabaseTool(platformProxy),
    neon_create_endpoint: createEndpointTool(platformProxy),
    neon_create_project: createProjectTool(platformProxy),
    neon_create_role: createRoleTool(platformProxy),
    neon_create_snapshot: createSnapshotTool(platformProxy),
    neon_delete_branch: deleteBranchTool(platformProxy),
    neon_delete_database: deleteDatabaseTool(platformProxy),
    neon_delete_endpoint: deleteEndpointTool(platformProxy),
    neon_delete_role: deleteRoleTool(platformProxy),
    neon_delete_snapshot: deleteSnapshotTool(platformProxy),
    neon_finalize_restore_branch: finalizeRestoreBranchTool(platformProxy),
    neon_get_auth_details: getAuthDetailsTool(platformProxy),
    neon_get_branch_consumption: getBranchConsumptionTool(platformProxy),
    neon_get_branch_schema: getBranchSchemaTool(platformProxy),
    neon_get_branch: getBranchTool(platformProxy),
    neon_get_database: getDatabaseTool(platformProxy),
    neon_get_endpoint: getEndpointTool(platformProxy),
    neon_get_operation: getOperationTool(platformProxy),
    neon_get_project_consumption: getProjectConsumptionTool(platformProxy),
    neon_get_project: getProjectTool(platformProxy),
    neon_get_role: getRoleTool(platformProxy),
    neon_get_snapshot_schedule: getSnapshotScheduleTool(platformProxy),
    neon_list_branch_endpoints: listBranchEndpointsTool(platformProxy),
    neon_list_branch_log_field_values: listBranchLogFieldValuesTool(platformProxy),
    neon_list_branch_log_fields: listBranchLogFieldsTool(platformProxy),
    neon_list_branches: listBranchesTool(platformProxy),
    neon_list_databases: listDatabasesTool(platformProxy),
    neon_list_endpoints: listEndpointsTool(platformProxy),
    neon_list_operations: listOperationsTool(platformProxy),
    neon_list_organizations: listOrganizationsTool(platformProxy),
    neon_list_projects: listProjectsTool(platformProxy),
    neon_list_regions: listRegionsTool(platformProxy),
    neon_list_roles: listRolesTool(platformProxy),
    neon_list_shared_projects: listSharedProjectsTool(platformProxy),
    neon_list_snapshots: listSnapshotsTool(platformProxy),
    neon_query_branch_logs: queryBranchLogsTool(platformProxy),
    neon_restart_endpoint: restartEndpointTool(platformProxy),
    neon_restore_branch: restoreBranchTool(platformProxy),
    neon_restore_snapshot: restoreSnapshotTool(platformProxy),
    neon_set_default_branch: setDefaultBranchTool(platformProxy),
    neon_set_snapshot_schedule: setSnapshotScheduleTool(platformProxy),
    neon_start_endpoint: startEndpointTool(platformProxy),
    neon_suspend_endpoint: suspendEndpointTool(platformProxy),
    neon_update_branch: updateBranchTool(platformProxy),
    neon_update_database: updateDatabaseTool(platformProxy),
    neon_update_endpoint: updateEndpointTool(platformProxy),
    neon_update_project: updateProjectTool(platformProxy),
    neon_update_snapshot: updateSnapshotTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
