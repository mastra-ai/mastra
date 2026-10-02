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
      'google_sheet_append_values',
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
      await call('google_sheet_append_values', {
        spreadsheetId,
        range,
        values: [expected],
      });
      steps.push(makeStep('append row', 'google_sheet_append_values', 'pass'));
    } catch (error) {
      steps.push(makeStep('append row', 'google_sheet_append_values', 'fail', errorMessage(error)));
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

    try {
      await call('google_sheet_clear_values', { spreadsheetId, range });
      steps.push(makeStep('clear values', 'google_sheet_clear_values', 'pass'));
    } catch (error) {
      steps.push(makeStep('clear values', 'google_sheet_clear_values', 'fail', errorMessage(error)));
    }

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
