// AUTO-GENERATED from NangoHQ/integration-templates @ bb789a55bfcf — do not edit by hand.
import { createPlatformProxy } from '../../runtime/platform-proxy.js';
import type { ProviderToolsOptions } from '../../toolset.js';
import { applyToolFilter } from '../../toolset.js';
import { appendValuesToSpreadsheetTool } from './tools/append-values-to-spreadsheet.js';
import { batchClearValuesByDataFilterTool } from './tools/batch-clear-values-by-data-filter.js';
import { batchClearValuesTool } from './tools/batch-clear-values.js';
import { batchGetValuesByDataFilterTool } from './tools/batch-get-values-by-data-filter.js';
import { batchGetValuesTool } from './tools/batch-get-values.js';
import { batchUpdateSpreadsheetTool } from './tools/batch-update-spreadsheet.js';
import { clearValuesTool } from './tools/clear-values.js';
import { copySheetTool } from './tools/copy-sheet.js';
import { createColumnTool } from './tools/create-column.js';
import { createSpreadsheetRowTool } from './tools/create-spreadsheet-row.js';
import { createSpreadsheetTool } from './tools/create-spreadsheet.js';
import { deleteWorksheetTool } from './tools/delete-worksheet.js';
import { getSpreadsheetByDataFilterTool } from './tools/get-spreadsheet-by-data-filter.js';
import { getValuesTool } from './tools/get-values.js';
import { searchDeveloperMetadataTool } from './tools/search-developer-metadata.js';
import { updateConditionalFormatRuleTool } from './tools/update-conditional-format-rule.js';
import { updateValuesTool } from './tools/update-values.js';
import { upsertRowTool } from './tools/upsert-row.js';

export function createGoogleSheetTools(options?: ProviderToolsOptions) {
  const platformProxy = createPlatformProxy({ connectionId: options?.connectionId, client: options?.client });
  const tools = {
    google_sheet_append_values_to_spreadsheet: appendValuesToSpreadsheetTool(platformProxy),
    google_sheet_batch_clear_values_by_data_filter: batchClearValuesByDataFilterTool(platformProxy),
    google_sheet_batch_clear_values: batchClearValuesTool(platformProxy),
    google_sheet_batch_get_values_by_data_filter: batchGetValuesByDataFilterTool(platformProxy),
    google_sheet_batch_get_values: batchGetValuesTool(platformProxy),
    google_sheet_batch_update_spreadsheet: batchUpdateSpreadsheetTool(platformProxy),
    google_sheet_clear_values: clearValuesTool(platformProxy),
    google_sheet_copy_sheet: copySheetTool(platformProxy),
    google_sheet_create_column: createColumnTool(platformProxy),
    google_sheet_create_spreadsheet_row: createSpreadsheetRowTool(platformProxy),
    google_sheet_create_spreadsheet: createSpreadsheetTool(platformProxy),
    google_sheet_delete_worksheet: deleteWorksheetTool(platformProxy),
    google_sheet_get_spreadsheet_by_data_filter: getSpreadsheetByDataFilterTool(platformProxy),
    google_sheet_get_values: getValuesTool(platformProxy),
    google_sheet_search_developer_metadata: searchDeveloperMetadataTool(platformProxy),
    google_sheet_update_conditional_format_rule: updateConditionalFormatRuleTool(platformProxy),
    google_sheet_update_values: updateValuesTool(platformProxy),
    google_sheet_upsert_row: upsertRowTool(platformProxy),
  };
  return applyToolFilter(tools, { allowTools: options?.allowTools, disallowTools: options?.disallowTools });
}
