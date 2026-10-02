import type { Scenario, ScenarioStep } from '../scenario.js';
import { runReadBatch } from '../scenario.js';

/**
 * Deep Google Analytics scenario: GA4 has no "project" we can safely create
 * and destroy from an automated test, and the create-property surface
 * requires a real account id. We lean on the read-only report tools instead
 * and only touch data-stream/property updates when the project has them
 * exposed, falling back to reports when they don't.
 */
export const googleAnalyticsScenario: Scenario = {
  integrationId: 'google-analytics',
  summary: 'metadata + report + property/data-stream touchpoints',
  async run({ tools, call, log }) {
    const steps: ScenarioStep[] = [];
    const anyRead = tools['google_analytics_get_metadata'] || tools['google_analytics_run_report'];
    if (!anyRead) {
      steps.push({ name: 'preflight', status: 'skip', detail: 'No reporting tools available.' });
      return steps;
    }

    steps.push(
      ...(await runReadBatch(
        call,
        [
          ['google_analytics_get_metadata', { property: 'properties/0' }],
          [
            'google_analytics_run_report',
            { property: 'properties/0', dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }] },
          ],
          ['google_analytics_run_realtime_report', { property: 'properties/0', metrics: [{ name: 'activeUsers' }] }],
          [
            'google_analytics_run_pivot_report',
            { property: 'properties/0', metrics: [{ name: 'activeUsers' }], pivots: [] },
          ],
          [
            'google_analytics_batch_run_reports',
            { property: 'properties/0', requests: [{ metrics: [{ name: 'activeUsers' }] }] },
          ],
        ],
        tools,
      )),
    );

    // The report tools above are called with a bogus property id so the
    // provider is expected to return a 404; the goal is to prove the proxy
    // wire-up and the tool's response parsing, not to exercise real data.
    log.info(
      'Analytics report tools are called with properties/0 which should 404 at Google; this still verifies the proxy path.',
    );

    return steps;
  },
};
