import { describe, expect, it } from 'vitest';
import { AlertReadClient, buildAlertReadTools, dashboardSearch } from './read-tools.js';

const DASH = 'https://projects.mastra.ai/org-1/proj-app';

function tools(rows: unknown, dashboardUrl: string | null = DASH) {
  const client = new AlertReadClient({
    mint: async () => ({
      token: 't',
      region: 'us',
      observabilityBaseUrl: 'https://obs',
      projectId: 'proj-app',
      expiresAt: new Date(Date.now() + 900_000).toISOString(),
      ...(dashboardUrl ? { dashboardUrl: `${dashboardUrl}/` } : {}),
    }),
    fetch: async () => new Response(JSON.stringify(rows)),
  });
  return buildAlertReadTools(client, 'org-1');
}

const run = (tool: { execute?: (input: never, ctx: never) => unknown }, input: unknown) =>
  tool.execute!(input as never, {} as never) as Promise<Record<string, unknown>>;

describe('alert read tools', () => {
  it("maps read filters onto each dashboard page's own params, dropping the rest", () => {
    expect(
      dashboardSearch('logs', {
        level: 'error',
        perPage: '50',
        entityName: 'weather-agent',
        'startedAt.start': '2026-11-16T17:00:00Z',
        'startedAt.end': '2026-11-16T17:05:00Z',
      }),
    ).toBe(
      '?filterLevel=error&filterEntityName=weather-agent&datePreset=custom&dateFrom=2026-11-16T17%3A00%3A00Z&dateTo=2026-11-16T17%3A05%3A00Z',
    );
    // The trace list filters status by a plain `status` param; logs have no status filter.
    expect(dashboardSearch('traces', { status: 'error', 'spans.error': 'true' })).toBe(
      '?status=error&filterSpanError=true',
    );
    expect(dashboardSearch('logs', { status: 'error', perPage: '5' })).toBe('');
    expect(dashboardSearch('traces', { level: 'error', madeUpField: 'x' })).toBe('');
  });

  it('links the filtered list and every trace and span a read returned', async () => {
    const t = tools({ logs: [{ traceId: 'tr-1', spanId: 'sp-1', message: 'boom' }, { message: 'no trace' }] });
    const out = await run(t.alert_list_logs, { incidentId: 'i1', filters: { level: 'error' } });
    expect(out['dashboardUrl']).toBe(`${DASH}/logs?filterLevel=error`);
    expect(out['result']).toEqual({
      logs: [
        { traceId: 'tr-1', spanId: 'sp-1', message: 'boom', dashboardUrl: `${DASH}/traces/tr-1?spanId=sp-1` },
        { message: 'no trace' },
      ],
    });
    const trace = await run(t.alert_get_trace, { incidentId: 'i1', traceId: 'tr-1' });
    expect(trace['dashboardUrl']).toBe(`${DASH}/traces/tr-1`);
  });

  it('returns the bare result when Platform sends no dashboard URL', async () => {
    const t = tools({ traces: [] }, null);
    expect(await run(t.alert_list_traces, { incidentId: 'i1' })).toEqual({ traces: [] });
  });
});
