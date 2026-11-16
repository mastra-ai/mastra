import type { Scenario, ScenarioStep } from '../scenario.js';
import { buildMinimalXlsx } from '../ooxml.js';
import { makeStep, errorMessage, requireTools, probeTool } from '../scenario.js';

const SHEET = 'Smoke';
const PERSONAL_UNSUPPORTED_TOOLS = new Set([
  'microsoft_excel_add_chart',
  'microsoft_excel_add_defined_name',
  'microsoft_excel_add_table',
  'microsoft_excel_add_table_rows',
  'microsoft_excel_add_worksheet',
  'microsoft_excel_calculate_workbook',
  'microsoft_excel_delete_defined_name',
  'microsoft_excel_delete_table',
  'microsoft_excel_delete_worksheet',
  'microsoft_excel_get_chart_image',
  'microsoft_excel_get_range',
  'microsoft_excel_get_used_range',
  'microsoft_excel_list_defined_names',
  'microsoft_excel_list_table_columns',
  'microsoft_excel_list_table_rows',
  'microsoft_excel_list_tables',
  'microsoft_excel_list_worksheets',
  'microsoft_excel_update_range',
  'microsoft_excel_update_worksheet',
]);
const isPersonalAccount = process.env.MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE?.trim().toLowerCase() === 'personal';

function isAccountCapabilityError(error: unknown): boolean {
  const detail = errorMessage(error);
  return (
    /personal|consumer|msa account|tenant-directory|work or school|sharepoint|FileOpenUserUnauthorized|access denied|not supported|not available/i.test(
      detail,
    ) ||
    // Graph answers tenant-directory calls from personal accounts with opaque errors such as `403 UnknownError`.
    (isPersonalAccount && /status=(400|401|403|405|501)/i.test(detail))
  );
}

/**
 * Deep Microsoft Excel scenario: resolves the connected user's OneDrive,
 * uploads a throwaway workbook tagged with the run id, exercises worksheet /
 * range / table / defined-name / chart tools against it, then deletes the
 * workbook. Charts have no delete tool of their own; they go away with the
 * workbook. Tenant-directory and SharePoint discovery are also exercised when
 * the connected account supports them.
 */
export const microsoftExcelScenario: Scenario = {
  integrationId: 'microsoft-excel',
  summary: 'upload workbook → worksheet/range/table/name/chart lifecycle → delete workbook',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    steps.push(
      makeStep(
        'account type',
        undefined,
        'pass',
        process.env.MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE?.trim().toLowerCase() ??
          'unknown; set MASTRA_SMOKE_MICROSOFT_ACCOUNT_TYPE=personal|work for capability classification',
      ),
    );
    const missing = requireTools(tools, [
      'microsoft_excel_get_user_drive',
      'microsoft_excel_create_workbook',
      'microsoft_excel_delete_workbook',
    ]);
    if (missing) {
      steps.push({ name: 'preflight', status: 'skip', detail: missing });
      return steps;
    }

    async function attempt(name: string, toolId: string, fn: () => Promise<string | void>): Promise<boolean> {
      try {
        const detail = await fn();
        steps.push(makeStep(name, toolId, 'pass', detail || undefined));
        return true;
      } catch (error) {
        steps.push(
          makeStep(
            name,
            toolId,
            isPersonalAccount && PERSONAL_UNSUPPORTED_TOOLS.has(toolId) && isAccountCapabilityError(error)
              ? 'skip'
              : 'fail',
            errorMessage(error),
          ),
        );
        return false;
      }
    }

    // Sessionless workbook writes can take several seconds to reach the copy that serves the next read,
    // so read-after-write checks retry before failing. Only wrap idempotent reads.
    async function eventually<T>(read: () => Promise<T>): Promise<T> {
      for (let poll = 1; ; poll++) {
        try {
          return await read();
        } catch (error) {
          if (poll >= 10) throw error;
          await new Promise(resolve => setTimeout(resolve, 2_000));
        }
      }
    }

    // ── drive discovery ────────────────────────────────────────────────────
    let driveId: string | undefined;
    const pinnedUser = process.env.MASTRA_SMOKE_EXCEL_USER_ID;
    try {
      const drive = await call<{ id: string }>(
        'microsoft_excel_get_user_drive',
        pinnedUser ? { userId: pinnedUser } : {},
      );
      driveId = drive.id;
      steps.push(
        makeStep(
          'get user drive',
          'microsoft_excel_get_user_drive',
          'pass',
          `${pinnedUser ?? 'connected user'} → ${drive.id}`,
        ),
      );
    } catch (error) {
      steps.push(makeStep('get user drive', 'microsoft_excel_get_user_drive', 'fail', errorMessage(error)));
    }

    try {
      const page = await call<{
        users: Array<{ id: string; userPrincipalName?: string }>;
        nextCursor?: string;
      }>('microsoft_excel_list_users', { top: 5 });
      if (page.nextCursor) {
        const next = await call<{ users: Array<{ id: string; userPrincipalName?: string }> }>(
          'microsoft_excel_list_users',
          { cursor: page.nextCursor, top: 5 },
        );
        steps.push(
          makeStep(
            'list users',
            'microsoft_excel_list_users',
            'pass',
            `${page.users.length} users, next page ${next.users.length}`,
          ),
        );
      } else {
        steps.push(makeStep('list users', 'microsoft_excel_list_users', 'pass', `${page.users.length} users`));
      }
    } catch (error) {
      steps.push(
        makeStep(
          'list users',
          'microsoft_excel_list_users',
          isPersonalAccount && isAccountCapabilityError(error) ? 'skip' : 'fail',
          errorMessage(error),
        ),
      );
    }

    let sites: Array<{ id: string; name?: string }> = [];
    try {
      const page = await call<{ items: typeof sites }>('microsoft_excel_list_sites', { query: '*' });
      sites = page.items;
      steps.push(makeStep('list sites', 'microsoft_excel_list_sites', 'pass', `${sites.length} sites`));
    } catch (error) {
      steps.push(
        makeStep(
          'list sites',
          'microsoft_excel_list_sites',
          isPersonalAccount && isAccountCapabilityError(error) ? 'skip' : 'fail',
          errorMessage(error),
        ),
      );
    }

    const site = sites[0];
    if (site) {
      await attempt('get site drive', 'microsoft_excel_get_site_drive', async () => {
        const drive = await call<{ id: string }>('microsoft_excel_get_site_drive', { siteId: site.id });
        return `${site.name ?? site.id} → ${drive.id}`;
      });
    } else {
      // Site discovery produced no real prerequisite, so verify the route with a synthetic SharePoint site id.
      steps.push(
        await probeTool(
          call,
          tools,
          'get site drive (probe)',
          'microsoft_excel_get_site_drive',
          {
            siteId: 'contoso.sharepoint.com,00000000-0000-0000-0000-000000000000,00000000-0000-0000-0000-000000000000',
          },
          /status=(400|403|404)|personal|msa account|work or school|sharepoint/i,
        ),
      );
    }

    if (!driveId) {
      steps.push({
        name: 'resolve drive',
        status: 'skip',
        detail: 'connected-user OneDrive unavailable; set MASTRA_SMOKE_EXCEL_USER_ID to opt into another user drive',
      });
      return steps;
    }

    // ── create workbook (bail on failure: nothing to clean up yet) ───────────
    const filename = `${runId}-smoke.xlsx`;
    let itemId: string;
    try {
      const created = await call<{ id: string; name: string }>('microsoft_excel_create_workbook', {
        driveId,
        filename,
        contentBase64: buildMinimalXlsx(SHEET).toString('base64'),
        conflictBehavior: 'fail',
      });
      itemId = created.id;
      steps.push(makeStep('create workbook', 'microsoft_excel_create_workbook', 'pass', `${created.name} (${itemId})`));
    } catch (error) {
      steps.push(makeStep('create workbook', 'microsoft_excel_create_workbook', 'fail', errorMessage(error)));
      return steps;
    }

    const wb = { driveId, itemId };

    // ── workbook reads ──────────────────────────────────────────────────────
    await attempt('get workbook', 'microsoft_excel_get_workbook', async () => {
      const got = await call<{ id: string; name: string }>('microsoft_excel_get_workbook', { driveId, itemId });
      if (got.id !== itemId || got.name !== filename) throw new Error(`unexpected workbook ${got.id} ${got.name}`);
    });

    // Drive search is eventually consistent; a fresh upload may not be indexed yet.
    await attempt('list workbooks', 'microsoft_excel_list_workbooks', async () => {
      const found = await call<{ workbooks: Array<{ id: string }> }>('microsoft_excel_list_workbooks', {
        driveId,
        query: runId,
      });
      const hit = found.workbooks.some(w => w.id === itemId);
      return `${found.workbooks.length} matches${hit ? ', includes smoke workbook' : ' (not indexed yet)'}`;
    });

    await attempt('list worksheets', 'microsoft_excel_list_worksheets', async () => {
      const got = await call<{ worksheets: Array<{ name: string }> }>('microsoft_excel_list_worksheets', wb);
      if (!got.worksheets.some(w => w.name === SHEET)) {
        throw new Error(`sheet ${SHEET} missing: ${got.worksheets.map(w => w.name).join(',')}`);
      }
    });

    // ── ranges ──────────────────────────────────────────────────────────────
    const values = [
      ['label', 'q1', 'q2'],
      [runId, 10, 20],
      ['beta', 30, 40],
    ];
    await attempt('update range', 'microsoft_excel_update_range', async () => {
      const got = await call<{ rowCount?: number; columnCount?: number }>('microsoft_excel_update_range', {
        driveId,
        itemId,
        worksheetIdOrName: SHEET,
        address: 'A1:C3',
        values,
      });
      if (got.rowCount !== 3 || got.columnCount !== 3) throw new Error(`wrote ${got.rowCount}x${got.columnCount}`);
    });

    await attempt('get range', 'microsoft_excel_get_range', () =>
      eventually(async () => {
        const got = await call<{ values?: unknown[][] }>('microsoft_excel_get_range', {
          driveId,
          itemId,
          worksheetIdOrName: SHEET,
          address: 'A1:C3',
        });
        if (got.values?.[1]?.[0] !== runId || got.values?.[2]?.[2] !== 40) {
          throw new Error(`read back ${JSON.stringify(got.values)}`);
        }
      }),
    );

    await attempt('get used range', 'microsoft_excel_get_used_range', () =>
      eventually(async () => {
        const got = await call<{ address?: string }>('microsoft_excel_get_used_range', {
          driveId,
          itemId,
          worksheetIdOrName: SHEET,
        });
        if (!got.address?.endsWith('A1:C3')) throw new Error(`used range ${got.address}`);
        return got.address;
      }),
    );

    await attempt('calculate workbook', 'microsoft_excel_calculate_workbook', async () => {
      await call('microsoft_excel_calculate_workbook', { driveId, itemId, calculationType: 'Recalculate' });
    });

    // ── worksheets ──────────────────────────────────────────────────────────
    let worksheetId: string | undefined;
    const sheetName = `${runId}-ws`.slice(0, 31);
    await attempt('add worksheet', 'microsoft_excel_add_worksheet', async () => {
      const got = await call<{ id: string; name: string }>('microsoft_excel_add_worksheet', {
        driveId,
        itemId,
        name: sheetName,
      });
      if (got.name !== sheetName) throw new Error(`created ${got.name}`);
      worksheetId = got.id;
      return got.id;
    });

    if (worksheetId) {
      const renamed = `${runId}-ws2`.slice(0, 31);
      await attempt('update worksheet', 'microsoft_excel_update_worksheet', async () => {
        const got = await call<{ name: string; position: number }>('microsoft_excel_update_worksheet', {
          driveId,
          itemId,
          worksheetIdOrName: worksheetId,
          name: renamed,
          position: 0,
        });
        if (got.name !== renamed || got.position !== 0) throw new Error(`now ${got.name}@${got.position}`);
      });
    } else {
      steps.push(makeStep('update worksheet', 'microsoft_excel_update_worksheet', 'skip', 'no worksheet created'));
    }

    // ── defined names ───────────────────────────────────────────────────────
    const definedName = `Smoke_${runId.replace(/[^A-Za-z0-9]/g, '_')}`;
    const nameAdded = await attempt('add defined name', 'microsoft_excel_add_defined_name', async () => {
      const got = await call<{ name: string }>('microsoft_excel_add_defined_name', {
        driveId,
        itemId,
        name: definedName,
        reference: `=${SHEET}!$B$2:$B$3`,
        comment: `${runId} smoke`,
      });
      if (got.name !== definedName) throw new Error(`created ${got.name}`);
    });

    await attempt('list defined names', 'microsoft_excel_list_defined_names', () =>
      eventually(async () => {
        const got = await call<{ names: Array<{ name: string }> }>('microsoft_excel_list_defined_names', wb);
        if (nameAdded && !got.names.some(n => n.name === definedName)) throw new Error(`${definedName} not listed`);
        return `${got.names.length} names`;
      }),
    );

    // ── tables ──────────────────────────────────────────────────────────────
    let tableId: string | undefined;
    await attempt('add table', 'microsoft_excel_add_table', async () => {
      const got = await call<{ id?: string; name?: string }>('microsoft_excel_add_table', {
        driveId,
        itemId,
        address: `${SHEET}!A1:C3`,
        hasHeaders: true,
      });
      tableId = got.id ?? got.name;
      if (!tableId) throw new Error('table created without id or name');
      return tableId;
    });

    if (tableId) {
      const table = { driveId, itemId, tableIdOrName: tableId };
      await attempt('list tables', 'microsoft_excel_list_tables', () =>
        eventually(async () => {
          const got = await call<{ tables: Array<{ id: string; name: string }> }>('microsoft_excel_list_tables', wb);
          if (!got.tables.some(t => t.id === tableId || t.name === tableId)) throw new Error(`${tableId} not listed`);
        }),
      );

      await attempt('list table columns', 'microsoft_excel_list_table_columns', () =>
        eventually(async () => {
          const got = await call<{ columns: Array<{ name?: string }> }>('microsoft_excel_list_table_columns', table);
          const names = got.columns.map(c => c.name).join(',');
          if (names !== 'label,q1,q2') throw new Error(`columns ${names}`);
        }),
      );

      await attempt('add table rows', 'microsoft_excel_add_table_rows', async () => {
        await call('microsoft_excel_add_table_rows', { ...table, values: [['gamma', 50, 60]] });
      });

      await attempt('list table rows', 'microsoft_excel_list_table_rows', () =>
        eventually(async () => {
          const got = await call<{ rows: Array<{ values: unknown[][] }> }>('microsoft_excel_list_table_rows', table);
          if (got.rows.length !== 3 || got.rows[2]?.values[0]?.[0] !== 'gamma') {
            throw new Error(`rows ${JSON.stringify(got.rows.map(r => r.values))}`);
          }
        }),
      );
    } else {
      for (const toolId of [
        'microsoft_excel_list_tables',
        'microsoft_excel_list_table_columns',
        'microsoft_excel_add_table_rows',
        'microsoft_excel_list_table_rows',
      ]) {
        steps.push(makeStep(toolId.replace('microsoft_excel_', ''), toolId, 'skip', 'no table created'));
      }
    }

    // ── charts ──────────────────────────────────────────────────────────────
    let chartId: string | undefined;
    await attempt('add chart', 'microsoft_excel_add_chart', async () => {
      const got = await call<{ id: string }>('microsoft_excel_add_chart', {
        driveId,
        itemId,
        worksheetIdOrName: SHEET,
        type: 'ColumnClustered',
        sourceData: `${SHEET}!A1:C3`,
        seriesBy: 'Auto',
      });
      chartId = got.id;
      return got.id;
    });

    if (chartId) {
      await attempt('get chart image', 'microsoft_excel_get_chart_image', () =>
        eventually(async () => {
          const got = await call<{ imageBase64: string }>('microsoft_excel_get_chart_image', {
            driveId,
            itemId,
            worksheetIdOrName: SHEET,
            chartId,
          });
          if (!got.imageBase64) throw new Error('empty image');
          return `${got.imageBase64.length} base64 chars`;
        }),
      );
    } else {
      steps.push(makeStep('get chart image', 'microsoft_excel_get_chart_image', 'skip', 'no chart created'));
    }

    // ── teardown of children (the workbook delete below catches any leak) ───
    if (tableId) {
      await attempt('delete table', 'microsoft_excel_delete_table', async () => {
        await call('microsoft_excel_delete_table', { driveId, itemId, tableIdOrName: tableId });
      });
    } else {
      steps.push(makeStep('delete table', 'microsoft_excel_delete_table', 'skip', 'no table created'));
    }

    if (nameAdded) {
      await attempt('delete defined name', 'microsoft_excel_delete_defined_name', async () => {
        await call('microsoft_excel_delete_defined_name', { driveId, itemId, name: definedName });
      });
    } else {
      steps.push(makeStep('delete defined name', 'microsoft_excel_delete_defined_name', 'skip', 'no name created'));
    }

    if (worksheetId) {
      await attempt('delete worksheet', 'microsoft_excel_delete_worksheet', async () => {
        await call('microsoft_excel_delete_worksheet', { driveId, itemId, worksheetIdOrName: worksheetId });
      });
    } else {
      steps.push(makeStep('delete worksheet', 'microsoft_excel_delete_worksheet', 'skip', 'no worksheet created'));
    }

    try {
      await call('microsoft_excel_delete_workbook', { driveId, itemId });
      steps.push(makeStep('delete workbook', 'microsoft_excel_delete_workbook', 'pass'));
    } catch (error) {
      log.error(`Failed to delete smoke workbook ${filename} (${itemId}) in drive ${driveId} — clean up manually.`, {
        error: errorMessage(error),
      });
      steps.push(makeStep('delete workbook', 'microsoft_excel_delete_workbook', 'fail', errorMessage(error)));
    }

    return steps;
  },
};
