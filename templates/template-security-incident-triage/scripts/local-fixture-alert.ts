import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import { AlertWebhookSchema } from '../src/app/webhooks/schemas.js';

const MINIMUM_SECRET_LENGTH = 16;

export type LocalFixtureScenario = 'privilege' | 'country' | 'device';
export type LocalFixtureOptions = Readonly<{
  environment?: NodeJS.ProcessEnv;
  now?: () => number;
  createId?: () => string;
}>;
export type SendLocalFixtureOptions = LocalFixtureOptions &
  Readonly<{ fetch?: typeof globalThis.fetch; printOnly?: boolean }>;

type AlertWebhook = ReturnType<typeof AlertWebhookSchema.parse>;

const fixtureFile: Readonly<Record<LocalFixtureScenario, string>> = {
  privilege: 'unauthorized-privilege-change.json',
  country: 'disallowed-country-login.json',
  device: 'unknown-device-login.json',
};

/**
 * Creates an alert from a teaching fixture. This is deliberately local-only:
 * staging exercises the real provider path through `/webhooks/workos`.
 */
export async function materializeLocalFixture(
  scenario: LocalFixtureScenario,
  options: LocalFixtureOptions = {},
): Promise<AlertWebhook> {
  const environment = options.environment ?? process.env;
  assertLocalMode(environment);

  const fixture = AlertWebhookSchema.parse(
    JSON.parse(await readFile(new URL(`./fixtures/${fixtureFile[scenario]}`, import.meta.url), 'utf8')),
  );
  const now = options.now ?? Date.now;
  const createId = options.createId ?? randomUUID;
  const sourceEventId = `${fixture.sourceEventId}-${createId().replaceAll('-', '')}`;
  const occurredAt = new Date(now()).toISOString();
  const tenantId = environment.INCIDENT_TENANT_ID ?? fixture.tenantId;
  const subjectId = environment.INCIDENT_SUBJECT_ID ?? fixture.subjectId;
  const source = environment.ALERT_WEBHOOK_SOURCE ?? fixture.source;
  const alert = {
    ...fixture,
    source,
    sourceEventId,
    occurredAt,
    tenantId,
    subjectId,
    actor: {
      ...fixture.actor,
      id: environment.INCIDENT_ACTOR_ID ?? (scenario === 'privilege' ? fixture.actor.id : subjectId),
    },
  };

  if (alert.target.type === 'user') alert.target.id = subjectId;
  if (scenario === 'country') {
    alert.sessionId = environment.INCIDENT_SESSION_ID ?? `${fixture.sessionId}-${sourceEventId}`;
    alert.ip = environment.COUNTRY_LOGIN_IP ?? fixture.ip;
    alert.target.id = alert.sessionId;
  }
  if (scenario === 'device') {
    alert.sessionId = environment.INCIDENT_SESSION_ID ?? `${fixture.sessionId}-${sourceEventId}`;
    alert.deviceId = environment.INCIDENT_DEVICE_ID ?? `${fixture.deviceId}-${sourceEventId}`;
    alert.ip = environment.UNKNOWN_DEVICE_IP ?? fixture.ip;
    alert.target.id = alert.deviceId;
  }
  if (scenario === 'privilege') {
    const previousRole = environment.PREVIOUS_ROLE ?? fixture.changes?.previousRole;
    const nextRole = environment.NEXT_ROLE ?? fixture.changes?.nextRole;
    if (typeof previousRole !== 'string' || typeof nextRole !== 'string')
      throw new Error('Privilege fixture must define previousRole and nextRole.');
    alert.changes = {
      ...fixture.changes,
      previousRole,
      nextRole,
    };
  }
  return AlertWebhookSchema.parse(alert);
}

/** Prints a local fixture or sends it to the local normalized-alert endpoint. */
export async function sendLocalFixture(
  scenario: LocalFixtureScenario,
  options: SendLocalFixtureOptions = {},
): Promise<
  | Readonly<{ alert: AlertWebhook; delivered: false }>
  | Readonly<{
      delivered: true;
      url: string;
      status: number;
      response?: unknown;
    }>
> {
  const environment = options.environment ?? process.env;
  const alert = await materializeLocalFixture(scenario, options);
  if (options.printOnly) return { alert, delivered: false };

  const secret = environment.ALERT_WEBHOOK_SECRET;
  if (!secret || secret.length < MINIMUM_SECRET_LENGTH)
    throw new Error('ALERT_WEBHOOK_SECRET must contain at least 16 characters.');

  const timestamp = String((options.now ?? Date.now)());
  const body = JSON.stringify(alert);
  const signature = createHmac('sha256', secret).update(`${timestamp}.`, 'utf8').update(body, 'utf8').digest('hex');
  const url = localWebhookUrl(environment);
  const response = await (options.fetch ?? globalThis.fetch)(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Alert-Signature': `t=${timestamp},v1=${signature}`,
    },
    body,
  });
  const responseBody = await parseResponse(response);
  if (!response.ok) throw new Error(`Alert webhook returned HTTP ${response.status}.`);
  return {
    delivered: true,
    url,
    status: response.status,
    response: responseBody,
  };
}

export function localWebhookUrl(environment: NodeJS.ProcessEnv = process.env): string {
  const configured = environment.ALERT_WEBHOOK_URL;
  if (configured) return new URL(configured).toString();
  return new URL('/webhooks/alerts', `http://localhost:${environment.PORT ?? '3000'}`).toString();
}

export function assertLocalMode(environment: NodeJS.ProcessEnv = process.env): void {
  const mode = environment.RUNTIME_MODE ?? 'local';
  if (mode !== 'local')
    throw new Error(
      `Local fixtures are disabled in RUNTIME_MODE=${mode}. In staging, sign in through WorkOS AuthKit and perform a controlled WorkOS action so WorkOS delivers the signed webhook.`,
    );
}

async function parseResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return { status: response.status };
  }
}
