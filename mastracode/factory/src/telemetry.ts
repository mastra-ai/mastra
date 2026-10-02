import { PostHog } from 'posthog-node';

import type { FactoryWebActivity } from './telemetry-types.js';

let client: PostHog | undefined;

/** Start with the default platform auth provider; custom identity authorities are separate work. */
export function isFactoryTelemetryEnabled(providerName: string | undefined): boolean {
  return (
    providerName === 'mastra-studio' &&
    !['1', 'true', 'yes'].includes(process.env.MASTRA_TELEMETRY_DISABLED?.trim().toLowerCase() ?? '')
  );
}

function env(name: string): string | undefined {
  return process.env[name]?.trim() || undefined;
}

/** Identity is resolved by the server. This never aliases existing CLI or platform profiles. */
export function captureFactoryWebActivity(
  activity: FactoryWebActivity,
  actor: { userId: string; orgId?: string },
): void {
  if (!isFactoryTelemetryEnabled('mastra-studio')) return;
  try {
    const deploymentId = env('MASTRA_DEPLOYMENT_ID');
    client ??= new PostHog('phc_SBLpZVAB6jmHOct9CABq3PF0Yn5FU3G2FgT4xUr2XrT', {
      host: 'https://us.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      maxQueueSize: 100,
      disableGeoip: true,
    });
    client.capture({
      distinctId: `factory:platform:${actor.userId}`,
      event: 'factory_web_activity',
      properties: {
        schema_version: 1,
        activity: activity.activity,
        page: activity.page,
        platform_user_id: actor.userId,
        platform_org_id: actor.orgId,
        platform_hosted: Boolean(deploymentId),
        platform_project_id: env('MASTRA_PROJECT_ID'),
        deployment_id: deploymentId,
        platform_region: env('MASTRA_PLATFORM_REGION'),
      },
    });
  } catch {
    // Analytics is best effort and must never interrupt Factory usage.
  }
}
