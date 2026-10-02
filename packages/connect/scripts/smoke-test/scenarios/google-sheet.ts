import type { ResolvedToolset, Scenario, ScenarioStep } from '../scenario.js';
import { requireTools, toolsForProvider } from '../scenario.js';

/**
 * Google Sheets smoke: create a spreadsheet, append a row, read it back,
 * update it, clear the sheet. Google Sheets has no "delete spreadsheet"
 * endpoint of its own — the Drive API owns file deletion. If the project
 * also has google-drive attached we use its `delete_file` tool for the
 * final cleanup; otherwise we leave the sheet behind and surface a leak.
 *
 * The runner only hands scenarios their own provider's tools. To look at
 * cross-provider surface we take a reference to the full toolset at run
 * start — see the `fullToolset` constant below.
 */
export const googleSheetScenario: Scenario = {
  integrationId: 'google-sheet',
  summary: 'create → append → read → update → clear (and delete file via google-drive if available)',
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

    const title = `${runId} smoke sheet`;
    const sheetName = 'Sheet1';

    let spreadsheetId: string | undefined;
    try {
      const created = await call<{ spreadsheetId: string }>('google_sheet_create_spreadsheet', {
        properties: { title },
      });
      spreadsheetId = created.spreadsheetId;
      steps.push({
        name: 'create spreadsheet',
        toolId: 'google_sheet_create_spreadsheet',
        status: 'pass',
        detail: spreadsheetId,
      });
    } catch (error) {
      steps.push({
        name: 'create spreadsheet',
        toolId: 'google_sheet_create_spreadsheet',
        status: 'fail',
        detail: errorMessage(error),
      });
      return steps;
    }

    const initialRow = ['smoke', runId, new Date().toISOString()];
    try {
      await call('google_sheet_append_values_to_spreadsheet', {
        spreadsheetId,
        range: `${sheetName}!A1`,
        values: [initialRow],
        valueInputOption: 'RAW',
      });
      steps.push({ name: 'append row', toolId: 'google_sheet_append_values_to_spreadsheet', status: 'pass' });
    } catch (error) {
      steps.push({
        name: 'append row',
        toolId: 'google_sheet_append_values_to_spreadsheet',
        status: 'fail',
        detail: errorMessage(error),
      });
    }

    try {
      const got = await call<{ values?: unknown[][] }>('google_sheet_get_values', {
        spreadsheetId,
        range: `${sheetName}!A1:C1`,
      });
      const first = got.values?.[0];
      const ok = Array.isArray(first) && first[0] === initialRow[0] && first[1] === initialRow[1];
      steps.push({
        name: 'read back',
        toolId: 'google_sheet_get_values',
        status: ok ? 'pass' : 'fail',
        detail: ok ? undefined : `Row did not match the appended values. Got: ${JSON.stringify(first ?? null)}`,
      });
    } catch (error) {
      steps.push({ name: 'read back', toolId: 'google_sheet_get_values', status: 'fail', detail: errorMessage(error) });
    }

    const renamedCell = `${runId} renamed`;
    try {
      await call('google_sheet_update_values', {
        spreadsheetId,
        range: `${sheetName}!A1`,
        values: [[renamedCell]],
        valueInputOption: 'RAW',
      });
      const after = await call<{ values?: unknown[][] }>('google_sheet_get_values', {
        spreadsheetId,
        range: `${sheetName}!A1`,
      });
      const ok = after.values?.[0]?.[0] === renamedCell;
      steps.push({
        name: 'update cell',
        toolId: 'google_sheet_update_values',
        status: ok ? 'pass' : 'fail',
        detail: ok ? undefined : `Expected "${renamedCell}", got "${after.values?.[0]?.[0] ?? '<none>'}".`,
      });
    } catch (error) {
      steps.push({
        name: 'update cell',
        toolId: 'google_sheet_update_values',
        status: 'fail',
        detail: errorMessage(error),
      });
    }

    try {
      await call('google_sheet_clear_values', {
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });
      steps.push({ name: 'clear values', toolId: 'google_sheet_clear_values', status: 'pass' });
    } catch (error) {
      steps.push({
        name: 'clear values',
        toolId: 'google_sheet_clear_values',
        status: 'fail',
        detail: errorMessage(error),
      });
    }

    // Final cleanup: delete the spreadsheet file via Drive if the project has
    // google-drive attached. If it doesn't, the sheet is left in the user's
    // Drive and we surface that as a `fail` step so the leak is visible.
    const driveTools: ResolvedToolset = toolsForProvider(allTools, 'google-drive');
    if (driveTools['google_drive_delete_file']) {
      try {
        await (driveTools['google_drive_delete_file'].execute as (i: unknown) => Promise<unknown>)({
          fileId: spreadsheetId,
        });
        steps.push({ name: 'delete file (drive)', toolId: 'google_drive_delete_file', status: 'pass' });
      } catch (error) {
        log.error(`Failed to delete smoke spreadsheet ${spreadsheetId} — clean up manually.`, errorMessage(error));
        steps.push({
          name: 'delete file (drive)',
          toolId: 'google_drive_delete_file',
          status: 'fail',
          detail: errorMessage(error),
        });
      }
    } else {
      log.warn(
        `Spreadsheet ${spreadsheetId} not deleted: google_drive_delete_file is not available in this toolset. Attach the google-drive integration to enable automatic cleanup.`,
      );
      steps.push({
        name: 'delete file',
        status: 'fail',
        detail: `Spreadsheet ${spreadsheetId} left in Drive — attach google-drive to enable cleanup.`,
      });
    }

    return steps;
  },
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
