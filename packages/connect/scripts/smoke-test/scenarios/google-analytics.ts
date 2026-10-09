import type { Scenario, ScenarioStep } from '../scenario.js';
import { makeStep, errorMessage, runReadBatch } from '../scenario.js';

/**
 * Deep Google Analytics scenario. GA4's write APIs (create_property,
 * create_data_stream, create_conversion_event) take an account id or
 * property id that the smoke test can't reasonably manufacture — the
 * provider toolset has no list_accounts, and we can't create an account
 * through the public API. For the write surface we invoke each tool with
 * a bogus parent id (accounts/0 or properties/0) and accept the 404 as
 * proof that routing + proxying + response parsing all work end-to-end.
 */
export const googleAnalyticsScenario: Scenario = {
  integrationId: 'google-analytics',
  summary: 'metadata + reports + property/data-stream/conversion-event touchpoints',
  async run({ tools, runId, call, log }) {
    const steps: ScenarioStep[] = [];
    const anyRead = tools['google_analytics_get_metadata'] || tools['google_analytics_run_report'];
    if (!anyRead) {
      steps.push({ name: 'preflight', status: 'skip', detail: 'No reporting tools available.' });
      return steps;
    }

    // Each tool aimed at a bogus parent id is a probe: GA returns a 400,
    // 403, or 404; all prove the endpoint is wired and the tool's response
    // schema accepts the error path.
    const probe = async (
      name: string,
      toolId: string,
      input: Record<string, unknown>,
      acceptable: RegExp = /status=(400|403|404)|not found|permission/i,
    ) => {
      if (!tools[toolId]) return;
      try {
        await call(toolId, input);
        steps.push(makeStep(name, toolId, 'pass'));
      } catch (error) {
        const msg = errorMessage(error);
        const expected = acceptable.test(msg);
        steps.push(makeStep(name, toolId, expected ? 'pass' : 'fail', expected ? `expected error: ${msg}` : msg));
      }
    };

    // Reports run for real against MASTRA_SMOKE_GA_PROPERTY_ID (e.g.
    // "properties/123456789") when set; otherwise they are probed against
    // properties/0 and the 4xx is accepted as routing proof.
    const realProperty = process.env.MASTRA_SMOKE_GA_PROPERTY_ID;
    const property = realProperty ?? 'properties/0';
    const reads: Array<[string, string, Record<string, unknown>]> = [
      ['get metadata', 'google_analytics_get_metadata', { property }],
      [
        'run report',
        'google_analytics_run_report',
        { property, dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }] },
      ],
      ['run realtime report', 'google_analytics_run_realtime_report', { property, metrics: [{ name: 'activeUsers' }] }],
      [
        'run pivot report',
        'google_analytics_run_pivot_report',
        { property, metrics: [{ name: 'activeUsers' }], pivots: [] },
      ],
      [
        'batch run reports',
        'google_analytics_batch_run_reports',
        { property, requests: [{ metrics: [{ name: 'activeUsers' }] }] },
      ],
    ];
    if (realProperty) {
      steps.push(
        ...(await runReadBatch(
          call,
          reads.map(([, toolId, input]): [string, Record<string, unknown>] => [toolId, input]),
          tools,
        )),
      );
    } else {
      for (const [name, toolId, input] of reads) {
        await probe(`${name} (probe)`, toolId, input);
      }
    }

    await probe('create property', 'google_analytics_create_property', {
      parent: 'accounts/0',
      displayName: `smoke ${runId}`,
      timeZone: 'UTC',
      currencyCode: 'USD',
    });
    await probe('update property', 'google_analytics_update_property', {
      name: 'properties/0',
      displayName: `smoke ${runId} (renamed)`,
    });
    await probe('create data stream', 'google_analytics_create_data_stream', {
      propertyId: '0',
      displayName: `smoke ${runId}`,
      type: 'WEB_DATA_STREAM',
      webStreamData: { default_uri: 'https://example.com' },
    });
    await probe('update data stream', 'google_analytics_update_data_stream', {
      propertyId: '0',
      dataStreamId: '0',
      displayName: `smoke ${runId} (renamed)`,
    });
    await probe('create conversion event', 'google_analytics_create_conversion_event', {
      propertyId: '0',
      eventName: `smoke_${runId}`,
      countingMethod: 'ONCE_PER_EVENT',
    });
    await probe('archive conversion event', 'google_analytics_archive_conversion_event', {
      property_id: '0',
      conversion_event_id: '0',
    });

    log.info(
      'Analytics write tools are called with synthetic ids (accounts/0, properties/0) which should 404 at Google — the smoke run proves the proxy path works.',
    );

    return steps;
  },
};
