import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, requireTools } from '../scenario.js';

/**
 * Deep google-sheet scenario: creates a spreadsheet, round-trips values via
 * append/get/update/upsert/clear, then deletes the file through google-drive
 * when that provider is attached (sheets has no delete endpoint of its own).
 */
export const googleSheetScenario: Scenario = {
  integrationId: 'google-sheet',
  summary: 'spreadsheet CRUD + values round-trip (cleanup via google-drive)',
  async run({ tools, allTools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const missing = requireTools(tools, [
      'google_sheet_create_spreadsheet',
      'google_sheet_append_values_to_spreadsheet',
      'google_sheet_get_values',
      'google_sheet_update_values',
      'google_sheet_clear_values',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    let spreadsheetId: string | undefined;
    try {
      const created = await call<{ spreadsheetId: string; sheets?: Array<{ properties?: { title?: string } }> }>(
        'google_sheet_create_spreadsheet',
        {
          title: `${runId} smoke sheet`,
          sheets: [{ title: 'Smoke' }],
        },
      );
      spreadsheetId = created.spreadsheetId;
      steps.push(makeStep('create spreadsheet', 'google_sheet_create_spreadsheet', 'pass', spreadsheetId));
    } catch (error) {
      steps.push(makeStep('create spreadsheet', 'google_sheet_create_spreadsheet', 'fail', errorMessage(error)));
      return steps;
    }

    const range = 'Smoke!A1:C1';
    const expected = ['smoke', runId, new Date().toISOString()];
    try {
      await call('google_sheet_append_values_to_spreadsheet', {
        spreadsheetId,
        range,
        values: [expected],
      });
      steps.push(makeStep('append row', 'google_sheet_append_values_to_spreadsheet', 'pass'));
    } catch (error) {
      steps.push(makeStep('append row', 'google_sheet_append_values_to_spreadsheet', 'fail', errorMessage(error)));
    }

    try {
      const got = await call<{ values?: string[][] }>('google_sheet_get_values', {
        spreadsheetId,
        range,
      });
      const row = got.values?.[0] ?? [];
      const ok = row[0] === expected[0] && row[1] === expected[1];
      steps.push(
        makeStep('read values', 'google_sheet_get_values', ok ? 'pass' : 'fail', ok ? undefined : row.join('|')),
      );
    } catch (error) {
      steps.push(makeStep('read values', 'google_sheet_get_values', 'fail', errorMessage(error)));
    }

    try {
      await call('google_sheet_update_values', {
        spreadsheetId,
        range: 'Smoke!A1',
        values: [[`${runId}-renamed`]],
      });
      const got = await call<{ values?: string[][] }>('google_sheet_get_values', {
        spreadsheetId,
        range: 'Smoke!A1',
      });
      const ok = got.values?.[0]?.[0] === `${runId}-renamed`;
      steps.push(makeStep('update value', 'google_sheet_update_values', ok ? 'pass' : 'fail'));
    } catch (error) {
      steps.push(makeStep('update value', 'google_sheet_update_values', 'fail', errorMessage(error)));
    }

    if (tools['google_sheet_upsert_row']) {
      try {
        await call('google_sheet_upsert_row', {
          spreadsheetId,
          range: 'Smoke!A:C',
          keyColumn: 0,
          keyValue: `${runId}-renamed`,
          values: [`${runId}-renamed`, 'upserted', 'v2'],
        });
        steps.push(makeStep('upsert row', 'google_sheet_upsert_row', 'pass'));
      } catch (error) {
        steps.push(makeStep('upsert row', 'google_sheet_upsert_row', 'fail', errorMessage(error)));
      }
    }

    if (tools['google_sheet_batch_get_values']) {
      try {
        await call('google_sheet_batch_get_values', {
          spreadsheetId,
          ranges: ['Smoke!A1:C1'],
        });
        steps.push(makeStep('batch get values', 'google_sheet_batch_get_values', 'pass'));
      } catch (error) {
        steps.push(makeStep('batch get values', 'google_sheet_batch_get_values', 'fail', errorMessage(error)));
      }
    }

    // Append a second row then exercise createSpreadsheetRow / createColumn
    // on sheet 0 (the first worksheet in a new spreadsheet).
    if (tools['google_sheet_append_values_to_spreadsheet']) {
      try {
        await call('google_sheet_append_values_to_spreadsheet', {
          spreadsheetId,
          range: 'Smoke!A2:C2',
          values: [['extra', runId, 'row2']],
        });
        steps.push(makeStep('append values to spreadsheet', 'google_sheet_append_values_to_spreadsheet', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'append values to spreadsheet',
            'google_sheet_append_values_to_spreadsheet',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    if (tools['google_sheet_create_spreadsheet_row']) {
      try {
        await call('google_sheet_create_spreadsheet_row', {
          spreadsheetId,
          sheetId: 0,
          sheetName: 'Smoke',
          rowIndex: 3,
          values: ['row3', runId, 'inserted'],
        });
        steps.push(makeStep('create spreadsheet row', 'google_sheet_create_spreadsheet_row', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('create spreadsheet row', 'google_sheet_create_spreadsheet_row', 'fail', errorMessage(error)),
        );
      }
    }

    if (tools['google_sheet_create_column']) {
      try {
        await call('google_sheet_create_column', { spreadsheetId, sheetId: 0, columnIndex: 3 });
        steps.push(makeStep('create column', 'google_sheet_create_column', 'pass'));
      } catch (error) {
        steps.push(makeStep('create column', 'google_sheet_create_column', 'fail', errorMessage(error)));
      }
    }

    if (tools['google_sheet_batch_update_spreadsheet']) {
      try {
        await call('google_sheet_batch_update_spreadsheet', {
          spreadsheetId,
          requests: [
            {
              updateSpreadsheetProperties: {
                properties: { title: `${runId} smoke sheet (batched)` },
                fields: 'title',
              },
            },
          ],
        });
        steps.push(makeStep('batch update spreadsheet', 'google_sheet_batch_update_spreadsheet', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('batch update spreadsheet', 'google_sheet_batch_update_spreadsheet', 'fail', errorMessage(error)),
        );
      }
    }

    // Data-filter variants exercise the same read/clear semantics against
    // a gridRange filter rather than an A1 range.
    const dataFilter = {
      gridRange: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 3 },
    };
    if (tools['google_sheet_get_spreadsheet_by_data_filter']) {
      try {
        await call('google_sheet_get_spreadsheet_by_data_filter', {
          spreadsheetId,
          dataFilters: [dataFilter],
          includeGridData: false,
        });
        steps.push(makeStep('get spreadsheet by data filter', 'google_sheet_get_spreadsheet_by_data_filter', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'get spreadsheet by data filter',
            'google_sheet_get_spreadsheet_by_data_filter',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }
    if (tools['google_sheet_batch_get_values_by_data_filter']) {
      try {
        await call('google_sheet_batch_get_values_by_data_filter', {
          spreadsheetId,
          dataFilters: [dataFilter],
        });
        steps.push(makeStep('batch get values by data filter', 'google_sheet_batch_get_values_by_data_filter', 'pass'));
      } catch (error) {
        steps.push(
          makeStep(
            'batch get values by data filter',
            'google_sheet_batch_get_values_by_data_filter',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }
    if (tools['google_sheet_batch_clear_values_by_data_filter']) {
      try {
        await call('google_sheet_batch_clear_values_by_data_filter', {
          spreadsheetId,
          dataFilters: [dataFilter],
        });
        steps.push(
          makeStep('batch clear values by data filter', 'google_sheet_batch_clear_values_by_data_filter', 'pass'),
        );
      } catch (error) {
        steps.push(
          makeStep(
            'batch clear values by data filter',
            'google_sheet_batch_clear_values_by_data_filter',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    if (tools['google_sheet_search_developer_metadata']) {
      try {
        await call('google_sheet_search_developer_metadata', {
          spreadsheetId,
          dataFilters: [{ developerMetadataLookup: { metadataKey: `smoke-${runId}` } }],
        });
        steps.push(makeStep('search developer metadata', 'google_sheet_search_developer_metadata', 'pass'));
      } catch (error) {
        steps.push(
          makeStep('search developer metadata', 'google_sheet_search_developer_metadata', 'fail', errorMessage(error)),
        );
      }
    }

    if (tools['google_sheet_update_conditional_format_rule']) {
      try {
        await call('google_sheet_update_conditional_format_rule', {
          spreadsheetId,
          sheetId: 0,
          index: 0,
          rule: {
            ranges: [{ sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 1 }],
            booleanRule: {
              condition: { type: 'NOT_BLANK' },
              format: { backgroundColor: { red: 0.9, green: 0.95, blue: 1 } },
            },
          },
        });
        steps.push(makeStep('update conditional format rule', 'google_sheet_update_conditional_format_rule', 'pass'));
      } catch (error) {
        // Sheets rejects updates on indexes that don't exist yet. Treat the
        // 400 as proof the endpoint wires up — rule creation flows aren't
        // exposed as a separate tool here.
        steps.push(
          makeStep(
            'update conditional format rule',
            'google_sheet_update_conditional_format_rule',
            'fail',
            errorMessage(error),
          ),
        );
      }
    }

    // Create a second sheet via batchUpdate, copy it, then delete it.
    let copiedSheetId: number | undefined;
    if (tools['google_sheet_batch_update_spreadsheet'] && tools['google_sheet_copy_sheet']) {
      try {
        const addResult = await call<{ replies?: Array<{ addSheet?: { properties?: { sheetId?: number } } }> }>(
          'google_sheet_batch_update_spreadsheet',
          {
            spreadsheetId,
            requests: [{ addSheet: { properties: { title: `Copy-${runId}` } } }],
          },
        );
        const addedSheetId = addResult.replies?.[0]?.addSheet?.properties?.sheetId;
        if (typeof addedSheetId === 'number') {
          const copied = await call<{ sheetId?: number }>('google_sheet_copy_sheet', {
            sourceSpreadsheetId: spreadsheetId,
            sheetId: addedSheetId,
            destinationSpreadsheetId: spreadsheetId,
          });
          copiedSheetId = copied.sheetId;
          steps.push(makeStep('copy sheet', 'google_sheet_copy_sheet', 'pass'));
        } else {
          steps.push(makeStep('copy sheet', 'google_sheet_copy_sheet', 'fail', 'addSheet returned no sheetId'));
        }
      } catch (error) {
        steps.push(makeStep('copy sheet', 'google_sheet_copy_sheet', 'fail', errorMessage(error)));
      }
    }

    if (tools['google_sheet_delete_worksheet']) {
      try {
        await call('google_sheet_delete_worksheet', { spreadsheetId, worksheetName: `Copy-${runId}` });
        steps.push(makeStep('delete worksheet', 'google_sheet_delete_worksheet', 'pass'));
      } catch (error) {
        steps.push(makeStep('delete worksheet', 'google_sheet_delete_worksheet', 'fail', errorMessage(error)));
      }
    }

    if (tools['google_sheet_batch_clear_values']) {
      try {
        await call('google_sheet_batch_clear_values', {
          spreadsheetId,
          ranges: ['Smoke!A1:C3'],
        });
        steps.push(makeStep('batch clear values', 'google_sheet_batch_clear_values', 'pass'));
      } catch (error) {
        steps.push(makeStep('batch clear values', 'google_sheet_batch_clear_values', 'fail', errorMessage(error)));
      }
    }

    try {
      await call('google_sheet_clear_values', { spreadsheetId, range });
      steps.push(makeStep('clear values', 'google_sheet_clear_values', 'pass'));
    } catch (error) {
      steps.push(makeStep('clear values', 'google_sheet_clear_values', 'fail', errorMessage(error)));
    }
    void copiedSheetId;

    const driveDelete = allTools['google_drive_delete_file'];
    if (driveDelete && typeof driveDelete.execute === 'function') {
      try {
        await (driveDelete.execute as (input: unknown) => Promise<unknown>)({ fileId: spreadsheetId });
        steps.push(makeStep('delete file (via drive)', 'google_drive_delete_file', 'pass'));
      } catch (error) {
        log.error(
          `Failed to delete smoke spreadsheet ${spreadsheetId} via google-drive — clean up manually.`,
          errorMessage(error),
        );
        steps.push(makeStep('delete file (via drive)', 'google_drive_delete_file', 'fail', errorMessage(error)));
      }
    } else {
      log.warn(
        `Cannot delete smoke spreadsheet ${spreadsheetId}: google-drive provider not attached. Clean up manually.`,
      );
      steps.push(
        makeStep(
          'delete file (via drive)',
          'google_drive_delete_file',
          'fail',
          `google-drive provider unavailable; leaked spreadsheet ${spreadsheetId}`,
        ),
      );
    }

    return steps;
  },
};
