// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { addChartTool } from './tools/add-chart.js';
import { addDefinedNameTool } from './tools/add-defined-name.js';
import { addTableRowsTool } from './tools/add-table-rows.js';
import { addTableTool } from './tools/add-table.js';
import { addWorksheetTool } from './tools/add-worksheet.js';
import { calculateWorkbookTool } from './tools/calculate-workbook.js';
import { createWorkbookTool } from './tools/create-workbook.js';
import { deleteDefinedNameTool } from './tools/delete-defined-name.js';
import { deleteTableTool } from './tools/delete-table.js';
import { deleteWorkbookTool } from './tools/delete-workbook.js';
import { deleteWorksheetTool } from './tools/delete-worksheet.js';
import { getChartImageTool } from './tools/get-chart-image.js';
import { getRangeTool } from './tools/get-range.js';
import { getSiteDriveTool } from './tools/get-site-drive.js';
import { getUsedRangeTool } from './tools/get-used-range.js';
import { getUserDriveTool } from './tools/get-user-drive.js';
import { getWorkbookTool } from './tools/get-workbook.js';
import { listDefinedNamesTool } from './tools/list-defined-names.js';
import { listSitesTool } from './tools/list-sites.js';
import { listTableColumnsTool } from './tools/list-table-columns.js';
import { listTableRowsTool } from './tools/list-table-rows.js';
import { listTablesTool } from './tools/list-tables.js';
import { listUsersTool } from './tools/list-users.js';
import { listWorkbooksTool } from './tools/list-workbooks.js';
import { updateRangeTool } from './tools/update-range.js';
import { updateWorksheetTool } from './tools/update-worksheet.js';

export function createMicrosoftExcelTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    microsoft_excel_add_chart: addChartTool(platformProxy),
    microsoft_excel_add_defined_name: addDefinedNameTool(platformProxy),
    microsoft_excel_add_table_rows: addTableRowsTool(platformProxy),
    microsoft_excel_add_table: addTableTool(platformProxy),
    microsoft_excel_add_worksheet: addWorksheetTool(platformProxy),
    microsoft_excel_calculate_workbook: calculateWorkbookTool(platformProxy),
    microsoft_excel_create_workbook: createWorkbookTool(platformProxy),
    microsoft_excel_delete_defined_name: deleteDefinedNameTool(platformProxy),
    microsoft_excel_delete_table: deleteTableTool(platformProxy),
    microsoft_excel_delete_workbook: deleteWorkbookTool(platformProxy),
    microsoft_excel_delete_worksheet: deleteWorksheetTool(platformProxy),
    microsoft_excel_get_chart_image: getChartImageTool(platformProxy),
    microsoft_excel_get_range: getRangeTool(platformProxy),
    microsoft_excel_get_site_drive: getSiteDriveTool(platformProxy),
    microsoft_excel_get_used_range: getUsedRangeTool(platformProxy),
    microsoft_excel_get_user_drive: getUserDriveTool(platformProxy),
    microsoft_excel_get_workbook: getWorkbookTool(platformProxy),
    microsoft_excel_list_defined_names: listDefinedNamesTool(platformProxy),
    microsoft_excel_list_sites: listSitesTool(platformProxy),
    microsoft_excel_list_table_columns: listTableColumnsTool(platformProxy),
    microsoft_excel_list_table_rows: listTableRowsTool(platformProxy),
    microsoft_excel_list_tables: listTablesTool(platformProxy),
    microsoft_excel_list_users: listUsersTool(platformProxy),
    microsoft_excel_list_workbooks: listWorkbooksTool(platformProxy),
    microsoft_excel_update_range: updateRangeTool(platformProxy),
    microsoft_excel_update_worksheet: updateWorksheetTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
