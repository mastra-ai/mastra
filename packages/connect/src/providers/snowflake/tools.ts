// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyAllowTools } from '../../toolset.js';
import { cancelStatementTool } from './tools/cancel-statement.js';
import { executeStatementTool } from './tools/execute-statement.js';
import { getStatementResultTool } from './tools/get-statement-result.js';
import { getStatementStatusTool } from './tools/get-statement-status.js';
import { listColumnsTool } from './tools/list-columns.js';
import { listDatabasesTool } from './tools/list-databases.js';
import { listRolesTool } from './tools/list-roles.js';
import { listSchemasTool } from './tools/list-schemas.js';
import { listStagesTool } from './tools/list-stages.js';
import { listStreamsTool } from './tools/list-streams.js';
import { listTablesTool } from './tools/list-tables.js';
import { listTasksTool } from './tools/list-tasks.js';
import { listUsersTool } from './tools/list-users.js';
import { listViewsTool } from './tools/list-views.js';
import { listWarehousesTool } from './tools/list-warehouses.js';

export function createSnowflakeTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    snowflake_cancel_statement: cancelStatementTool(platformProxy),
    snowflake_execute_statement: executeStatementTool(platformProxy),
    snowflake_get_statement_result: getStatementResultTool(platformProxy),
    snowflake_get_statement_status: getStatementStatusTool(platformProxy),
    snowflake_list_columns: listColumnsTool(platformProxy),
    snowflake_list_databases: listDatabasesTool(platformProxy),
    snowflake_list_roles: listRolesTool(platformProxy),
    snowflake_list_schemas: listSchemasTool(platformProxy),
    snowflake_list_stages: listStagesTool(platformProxy),
    snowflake_list_streams: listStreamsTool(platformProxy),
    snowflake_list_tables: listTablesTool(platformProxy),
    snowflake_list_tasks: listTasksTool(platformProxy),
    snowflake_list_users: listUsersTool(platformProxy),
    snowflake_list_views: listViewsTool(platformProxy),
    snowflake_list_warehouses: listWarehousesTool(platformProxy),
  };
  return applyAllowTools(tools, options?.allowTools);
}
