import { sendLocalFixture, type LocalFixtureScenario, type SendLocalFixtureOptions } from './local-fixture-alert.js';
import {
  executeWorkOsStagingAction,
  type WorkOsStagingAction,
  type WorkOsStagingActionClient,
} from './workos-staging-actions.js';

export type Scenario = LocalFixtureScenario;

export type StagingTriggerInstructions = Readonly<{
  mode: 'staging';
  scenario: Scenario;
  provider: 'workos' | 'workos+first-party-device-trust';
  expectedEvent: 'organization_membership.updated' | 'session.created' | 'unknown_device_login';
  action: string;
  loginUrl?: string;
  verification: readonly string[];
}>;

export async function triggerScenario(
  scenario: Scenario,
  options: SendLocalFixtureOptions &
    Readonly<{
      stagingAction?: WorkOsStagingAction;
      workosClient?: WorkOsStagingActionClient;
    }> = {},
) {
  const environment = options.environment ?? process.env;
  const mode = environment.RUNTIME_MODE ?? 'local';

  if (mode === 'local') {
    if (options.stagingAction) throw new Error('Staging action flags cannot be used in local mode.');
    return sendLocalFixture(scenario, options);
  }
  if (mode === 'production') throw new Error('Scenario triggers are disabled in production.');
  if (mode !== 'staging') throw new Error(`Unsupported RUNTIME_MODE=${mode}.`);

  assertWorkOsStagingReady(environment, scenario);
  if (options.stagingAction) {
    if (
      (scenario === 'country' && options.stagingAction.kind !== 'password-login') ||
      (scenario === 'privilege' && options.stagingAction.kind !== 'membership-role-change') ||
      (scenario === 'device' && options.stagingAction.kind !== 'device-login')
    )
      throw new Error('The staging action does not match the scenario.');
    return executeWorkOsStagingAction(options.stagingAction, environment, options.workosClient);
  }

  const common = {
    mode: 'staging' as const,
    scenario,
    provider: 'workos' as const,
    verification: [
      'WorkOS delivers the event to /webhooks/workos.',
      'The response is 2xx and is not dead_lettered.',
      'The dashboard shows either a closed benign record or an actionable incident awaiting approval.',
    ],
  };
  if (scenario === 'device')
    return {
      ...common,
      provider: 'workos+first-party-device-trust' as const,
      expectedEvent: 'unknown_device_login' as const,
      action:
        'Run trigger:device with --user, --password-stdin, --new-device, and --execute. WorkOS authenticates the real user; the application generates and verifies a fresh Ed25519 device identity before emitting the signed alert.',
    } satisfies StagingTriggerInstructions;
  if (scenario === 'country')
    return {
      ...common,
      expectedEvent: 'session.created' as const,
      action:
        'Open loginUrl for an interactive AuthKit sign-in, or run trigger:country with --user, --password-stdin, --ip, and --execute. The executable path verifies the public IP through IPinfo first; an allowed-country login closes as benign and an outside-country login proceeds to incident response.',
      loginUrl: new URL('/auth/login', environment.DASHBOARD_ORIGIN ?? 'http://localhost:3000').toString(),
    } satisfies StagingTriggerInstructions;

  return {
    ...common,
    expectedEvent: 'organization_membership.updated' as const,
    action:
      'Run trigger:privilege with --userId, --role=admin, and --execute. The command records a short-lived staging intent from the official pre-change WorkOS state before updating the real membership; a manual dashboard change has no trusted actor/authorization context and intentionally requires manual review.',
  } satisfies StagingTriggerInstructions;
}

function assertWorkOsStagingReady(environment: NodeJS.ProcessEnv, scenario: Scenario): void {
  const missing = [
    environment.WORKOS_PROVIDER_ENABLED !== 'true' ? 'WORKOS_PROVIDER_ENABLED=true' : undefined,
    environment.WEBHOOKS_ENABLED !== 'true' ? 'WEBHOOKS_ENABLED=true' : undefined,
    environment.DASHBOARD_AUTH_ENABLED !== 'true' ? 'DASHBOARD_AUTH_ENABLED=true' : undefined,
    !environment.WORKOS_API_KEY ? 'WORKOS_API_KEY' : undefined,
    !environment.WORKOS_WEBHOOK_SECRET ? 'WORKOS_WEBHOOK_SECRET' : undefined,
    !environment.WORKOS_ORGANIZATION_ID ? 'WORKOS_ORGANIZATION_ID' : undefined,
    !environment.WORKOS_ALLOWED_ROLE_SLUGS ? 'WORKOS_ALLOWED_ROLE_SLUGS' : undefined,
    !environment.WORKOS_CLIENT_ID ? 'WORKOS_CLIENT_ID' : undefined,
    !environment.WORKOS_REDIRECT_URI ? 'WORKOS_REDIRECT_URI' : undefined,
    environment.IPINFO_PROVIDER_ENABLED !== 'true' ? 'IPINFO_PROVIDER_ENABLED=true' : undefined,
    !environment.IPINFO_TOKEN ? 'IPINFO_TOKEN' : undefined,
    !environment.GEOIP_CACHE_HMAC_KEY ? 'GEOIP_CACHE_HMAC_KEY' : undefined,
    !environment.GEOIP_CACHE_HMAC_KEY_VERSION ? 'GEOIP_CACHE_HMAC_KEY_VERSION' : undefined,
  ].filter((value): value is string => Boolean(value));

  if (scenario === 'device') {
    if (environment.DEVICE_TRUST_PROVIDER_ENABLED !== 'true') missing.push('DEVICE_TRUST_PROVIDER_ENABLED=true');
    const source = environment.DEVICE_TRUST_ALERT_SOURCE ?? 'first-party-device-trust';
    const sources = new Set((environment.ALERT_WEBHOOK_SOURCES ?? '').split(',').map(value => value.trim()));
    if (!environment.ALERT_WEBHOOK_SECRET) missing.push('ALERT_WEBHOOK_SECRET');
    if (!sources.has(source)) missing.push(`ALERT_WEBHOOK_SOURCES must include ${source}`);
  }

  if (missing.length > 0) throw new Error(`WorkOS staging is not ready. Missing: ${missing.join(', ')}.`);
}
